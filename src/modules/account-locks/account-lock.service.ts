import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
import { UUID_PATTERN } from "../../lib/validation-patterns.js";
import type { DatabaseClient } from "../../types/database.types.js";
import type {
  AccountLockResponse,
  AccountLockService,
  LockAccountCommand,
} from "./types/account-lock.types.js";

const UUID_REGEXP = new RegExp(UUID_PATTERN);

type AccountRow = Readonly<{ id: string }>;

/** Acquires the account-row lock shared with transfer transactions. */
async function selectAccountForUpdate(
  transaction: Prisma.TransactionClient,
  accountId: string,
): Promise<AccountRow | undefined> {
  const accounts = await transaction.$queryRaw<AccountRow[]>`
    SELECT "id"
    FROM "accounts"
    WHERE "id" = ${accountId}::uuid
    FOR UPDATE
  `;
  return accounts[0];
}

/** Maps persisted lock history to its HTTP representation. */
function mapAccountLock(lock: {
  id: string;
  accountId: string;
  reason: string;
  lockedByEmployeeId: string;
  unlockedByEmployeeId: string | null;
  lockedAt: Date;
  unlockedAt: Date | null;
}): AccountLockResponse {
  return {
    id: lock.id,
    accountId: lock.accountId,
    reason: lock.reason,
    lockedByEmployeeId: lock.lockedByEmployeeId,
    lockedAt: lock.lockedAt.toISOString(),
    unlockedByEmployeeId: lock.unlockedByEmployeeId,
    unlockedAt: lock.unlockedAt?.toISOString() ?? null,
  };
}

/** Validates and normalizes an account lock command. */
function normalizeLockCommand(command: LockAccountCommand): LockAccountCommand {
  const reason = command.reason.trim();
  if (!UUID_REGEXP.test(command.accountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Account ID is invalid");
  }
  if (reason.length === 0 || reason.length > 500) {
    throw new AppError(
      400,
      "INVALID_LOCK_REASON",
      "Lock reason must contain between 1 and 500 characters",
    );
  }
  return { ...command, accountId: command.accountId.toLowerCase(), reason };
}

/** Creates transactional account-level lock and unlock operations. */
export function createAccountLockService(
  database: DatabaseClient,
): AccountLockService {
  return {
    async lockAccount(input) {
      const command = normalizeLockCommand(input);
      return database.$transaction(async (transaction) => {
        const account = await selectAccountForUpdate(
          transaction,
          command.accountId,
        );
        if (!account) {
          throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found");
        }

        const activeLock = await transaction.accountLock.findFirst({
          where: { accountId: account.id, unlockedAt: null },
          select: { id: true },
        });
        if (activeLock) {
          throw new AppError(
            409,
            "ACCOUNT_ALREADY_LOCKED",
            "Account already has an active lock",
          );
        }

        const lock = await transaction.accountLock.create({
          data: {
            accountId: account.id,
            reason: command.reason,
            lockedByEmployeeId: command.employeeId,
          },
        });
        return mapAccountLock(lock);
      });
    },

    async unlockAccount(command) {
      if (!UUID_REGEXP.test(command.accountId)) {
        throw new AppError(400, "INVALID_ACCOUNT_ID", "Account ID is invalid");
      }
      const accountId = command.accountId.toLowerCase();

      await database.$transaction(async (transaction) => {
        const account = await selectAccountForUpdate(transaction, accountId);
        if (!account) {
          throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found");
        }

        const activeLock = await transaction.accountLock.findFirst({
          where: { accountId: account.id, unlockedAt: null },
          select: { id: true },
        });
        if (!activeLock) {
          return;
        }

        await transaction.accountLock.update({
          where: { id: activeLock.id },
          data: {
            unlockedAt: new Date(),
            unlockedByEmployeeId: command.employeeId,
          },
        });
      });
    },
  };
}
