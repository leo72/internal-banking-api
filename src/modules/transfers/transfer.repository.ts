import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
import { formatMinorUnits } from "../../lib/money.js";
import type { DatabaseClient } from "../../types/database.types.js";
import type {
  ExecuteTransferCommand,
  TransferExecutionResult,
  TransferHistoryItem,
  TransferRepository,
  TransferResponse,
} from "./types/transfer.types.js";

const TRANSFER_OPERATION = "transfer:create";
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

type LockedAccountRow = Readonly<{
  id: string;
  currency: string;
  balanceMinor: bigint;
}>;

type IdempotencyReader = DatabaseClient | Prisma.TransactionClient;

/** Loads a globally scoped idempotency result when one already exists. */
async function findIdempotencyRecord(
  database: IdempotencyReader,
  command: ExecuteTransferCommand,
) {
  return database.idempotencyRecord.findUnique({
    where: {
      operation_keyHash: {
        operation: TRANSFER_OPERATION,
        keyHash: command.idempotencyKeyHash,
      },
    },
    select: {
      requestHash: true,
      responseStatus: true,
      responseBody: true,
    },
  });
}

/** Resolves a stored replay or reports incompatible key reuse. */
function resolveIdempotencyRecord(
  record: NonNullable<Awaited<ReturnType<typeof findIdempotencyRecord>>>,
  requestHash: string,
): TransferExecutionResult {
  if (record.requestHash !== requestHash) {
    return {
      statusCode: 409,
      body: {
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "Idempotency-Key was already used for another request",
      },
      isReplay: false,
    };
  }

  return {
    statusCode: record.responseStatus,
    body: record.responseBody,
    isReplay: true,
  };
}

/** Selects and row-locks both transfer accounts in deterministic UUID order. */
async function selectTransferAccountsForUpdate(
  transaction: Prisma.TransactionClient,
  sourceAccountId: string,
  destinationAccountId: string,
): Promise<LockedAccountRow[]> {
  const firstAccountId =
    sourceAccountId < destinationAccountId
      ? sourceAccountId
      : destinationAccountId;
  const secondAccountId =
    sourceAccountId < destinationAccountId
      ? destinationAccountId
      : sourceAccountId;

  return transaction.$queryRaw<LockedAccountRow[]>`
    SELECT
      "id",
      "currency",
      "balance_minor" AS "balanceMinor"
    FROM "accounts"
    WHERE "id" IN (${firstAccountId}::uuid, ${secondAccountId}::uuid)
    ORDER BY "id" ASC
    FOR UPDATE
  `;
}

/** Stores a deterministic business rejection as the idempotency result. */
async function storeBusinessRejection(
  transaction: Prisma.TransactionClient,
  command: ExecuteTransferCommand,
  statusCode: number,
  code: string,
  message: string,
): Promise<TransferExecutionResult> {
  const body = {
    status: statusCode,
    code,
    message,
  } satisfies Prisma.InputJsonObject;

  await transaction.idempotencyRecord.create({
    data: {
      operation: TRANSFER_OPERATION,
      createdByEmployeeId: command.employeeId,
      keyHash: command.idempotencyKeyHash,
      requestHash: command.requestHash,
      responseStatus: statusCode,
      responseBody: body,
    },
  });

  return { statusCode, body, isReplay: false };
}

/** Executes the complete monetary operation in one database transaction. */
async function executeInTransaction(
  database: DatabaseClient,
  command: ExecuteTransferCommand,
): Promise<TransferExecutionResult> {
  return database.$transaction(
    async (transaction) => {
      if (command.sourceAccountId === command.destinationAccountId) {
        return storeBusinessRejection(
          transaction,
          command,
          422,
          "SAME_ACCOUNT_TRANSFER",
          "Source and destination accounts must be different",
        );
      }

      if (command.amountMinor <= 0n) {
        return storeBusinessRejection(
          transaction,
          command,
          422,
          "INVALID_TRANSFER_AMOUNT",
          "Transfer amount must be greater than zero",
        );
      }

      const accounts = await selectTransferAccountsForUpdate(
        transaction,
        command.sourceAccountId,
        command.destinationAccountId,
      );
      const existingRecord = await findIdempotencyRecord(transaction, command);
      if (existingRecord) {
        return resolveIdempotencyRecord(existingRecord, command.requestHash);
      }

      const sourceAccount = accounts.find(
        (account) => account.id === command.sourceAccountId,
      );
      const destinationAccount = accounts.find(
        (account) => account.id === command.destinationAccountId,
      );
      if (!sourceAccount || !destinationAccount) {
        return storeBusinessRejection(
          transaction,
          command,
          404,
          "ACCOUNT_NOT_FOUND",
          "Source or destination account was not found",
        );
      }

      if (sourceAccount.currency !== destinationAccount.currency) {
        return storeBusinessRejection(
          transaction,
          command,
          422,
          "CURRENCY_MISMATCH",
          "Transfers require accounts with the same currency",
        );
      }

      const activeLock = await transaction.accountLock.findFirst({
        where: {
          accountId: {
            in: [command.sourceAccountId, command.destinationAccountId],
          },
          unlockedAt: null,
        },
        select: { id: true },
      });
      if (activeLock) {
        return storeBusinessRejection(
          transaction,
          command,
          423,
          "ACCOUNT_LOCKED",
          "Source or destination account is locked",
        );
      }

      if (sourceAccount.balanceMinor < command.amountMinor) {
        return storeBusinessRejection(
          transaction,
          command,
          422,
          "INSUFFICIENT_FUNDS",
          "Source account has insufficient funds",
        );
      }

      if (
        destinationAccount.balanceMinor >
        MAX_POSTGRES_BIGINT - command.amountMinor
      ) {
        return storeBusinessRejection(
          transaction,
          command,
          422,
          "BALANCE_LIMIT_EXCEEDED",
          "Transfer would exceed the destination balance limit",
        );
      }

      const sourceBalanceAfter =
        sourceAccount.balanceMinor - command.amountMinor;
      const destinationBalanceAfter =
        destinationAccount.balanceMinor + command.amountMinor;
      await transaction.account.update({
        where: { id: sourceAccount.id },
        data: { balanceMinor: sourceBalanceAfter },
      });
      await transaction.account.update({
        where: { id: destinationAccount.id },
        data: { balanceMinor: destinationBalanceAfter },
      });

      const transfer = await transaction.transfer.create({
        data: {
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          amountMinor: command.amountMinor,
          currency: sourceAccount.currency,
          sourceBalanceAfter,
          destinationBalanceAfter,
          initiatedByEmployeeId: command.employeeId,
        },
      });
      const body = {
        id: transfer.id,
        sourceAccountId: transfer.sourceAccountId,
        destinationAccountId: transfer.destinationAccountId,
        amount: formatMinorUnits(transfer.amountMinor),
        currency: transfer.currency,
        sourceBalanceAfter: formatMinorUnits(transfer.sourceBalanceAfter),
        destinationBalanceAfter: formatMinorUnits(
          transfer.destinationBalanceAfter,
        ),
        initiatedByEmployeeId: transfer.initiatedByEmployeeId,
        createdAt: transfer.createdAt.toISOString(),
      } satisfies TransferResponse & Prisma.InputJsonObject;

      await transaction.idempotencyRecord.create({
        data: {
          operation: TRANSFER_OPERATION,
          createdByEmployeeId: command.employeeId,
          keyHash: command.idempotencyKeyHash,
          requestHash: command.requestHash,
          responseStatus: 201,
          responseBody: body,
          transferId: transfer.id,
        },
      });

      return { statusCode: 201, body, isReplay: false };
    },
    {
      isolationLevel: "ReadCommitted",
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
}

/** Maps an immutable transfer to the queried account's perspective. */
function mapHistoryItem(
  transfer: {
    id: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amountMinor: bigint;
    currency: string;
    sourceBalanceAfter: bigint;
    destinationBalanceAfter: bigint;
    initiatedByEmployeeId: string;
    createdAt: Date;
  },
  accountId: string,
): TransferHistoryItem {
  const isOutgoing = transfer.sourceAccountId === accountId;

  return {
    id: transfer.id,
    direction: isOutgoing ? "OUTGOING" : "INCOMING",
    sourceAccountId: transfer.sourceAccountId,
    destinationAccountId: transfer.destinationAccountId,
    amount: formatMinorUnits(transfer.amountMinor),
    currency: transfer.currency,
    balanceAfter: formatMinorUnits(
      isOutgoing
        ? transfer.sourceBalanceAfter
        : transfer.destinationBalanceAfter,
    ),
    initiatedByEmployeeId: transfer.initiatedByEmployeeId,
    createdAt: transfer.createdAt.toISOString(),
  };
}

/** Creates PostgreSQL-backed transfer execution and history operations. */
export function createTransferRepository(
  database: DatabaseClient,
): TransferRepository {
  return {
    async executeTransfer(command) {
      const existingRecord = await findIdempotencyRecord(database, command);
      if (existingRecord) {
        return resolveIdempotencyRecord(existingRecord, command.requestHash);
      }

      try {
        return await executeInTransaction(database, command);
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const conflictingRecord = await findIdempotencyRecord(
            database,
            command,
          );
          if (conflictingRecord) {
            return resolveIdempotencyRecord(
              conflictingRecord,
              command.requestHash,
            );
          }
        }
        throw error;
      }
    },

    async getAccountHistory(accountId) {
      const account = await database.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      });
      if (!account) {
        throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found");
      }

      const transfers = await database.transfer.findMany({
        where: {
          OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      return {
        accountId,
        transfers: transfers.map((transfer) =>
          mapHistoryItem(transfer, accountId),
        ),
      };
    },
  };
}
