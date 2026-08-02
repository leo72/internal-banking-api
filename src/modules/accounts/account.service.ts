import { AppError } from "../../errors/app-error.js";
import {
  formatMinorUnits,
  parseMoneyToMinorUnits,
} from "../../lib/money.js";
import { CURRENCY_CODE_PATTERN } from "../../lib/validation-patterns.js";
import type { DatabaseClient } from "../../types/database.types.js";
import type {
  AccountService,
  CreateAccountCommand,
} from "./types/account.types.js";

const MAX_POSTGRES_INTEGER = 2_147_483_647;
const CURRENCY_PATTERN = new RegExp(CURRENCY_CODE_PATTERN);

/** Converts a validated account-opening amount into minor units. */
function parseInitialDeposit(initialDeposit: string): bigint {
  try {
    return parseMoneyToMinorUnits(initialDeposit);
  } catch {
    throw new AppError(
      400,
      "INVALID_INITIAL_DEPOSIT",
      "Initial deposit must be a nonnegative amount with at most two decimals",
    );
  }
}

/** Validates domain input when the service is called outside the HTTP layer. */
function validateCreateAccountCommand(command: CreateAccountCommand): void {
  if (
    !Number.isInteger(command.customerId) ||
    command.customerId < 1 ||
    command.customerId > MAX_POSTGRES_INTEGER
  ) {
    throw new AppError(400, "INVALID_CUSTOMER_ID", "Customer ID is invalid");
  }

  if (!CURRENCY_PATTERN.test(command.currency)) {
    throw new AppError(
      400,
      "INVALID_CURRENCY",
      "Currency must be a three-letter uppercase code",
    );
  }
}

/** Creates account operations backed by Prisma. */
export function createAccountService(database: DatabaseClient): AccountService {
  return {
    async createAccount(command) {
      validateCreateAccountCommand(command);
      const initialDepositMinor = parseInitialDeposit(command.initialDeposit);
      const customer = await database.customer.findUnique({
        where: { id: command.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const account = await database.account.create({
        data: {
          customerId: command.customerId,
          currency: command.currency,
          initialDepositMinor,
          balanceMinor: initialDepositMinor,
        },
        select: {
          id: true,
          customerId: true,
          currency: true,
          initialDepositMinor: true,
          balanceMinor: true,
          createdAt: true,
        },
      });

      return {
        id: account.id,
        customerId: account.customerId,
        currency: account.currency,
        initialDeposit: formatMinorUnits(account.initialDepositMinor),
        balance: formatMinorUnits(account.balanceMinor),
        createdAt: account.createdAt.toISOString(),
      };
    },

    async getAccountBalance(accountId) {
      const account = await database.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          currency: true,
          balanceMinor: true,
          locks: {
            where: { unlockedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!account) {
        throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found");
      }

      return {
        accountId: account.id,
        currency: account.currency,
        balance: formatMinorUnits(account.balanceMinor),
        isLocked: account.locks.length > 0,
      };
    },
  };
}
