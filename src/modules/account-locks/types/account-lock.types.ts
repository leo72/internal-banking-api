import type { Static } from "@sinclair/typebox";

import type {
  AccountLockResponseSchema,
  CreateAccountLockBodySchema,
} from "../account-lock.schemas.js";

export type CreateAccountLockBody = Static<
  typeof CreateAccountLockBodySchema
>;
export type AccountLockResponse = Static<typeof AccountLockResponseSchema>;

export type LockAccountCommand = Readonly<{
  accountId: string;
  reason: string;
  employeeId: string;
}>;

export type UnlockAccountCommand = Readonly<{
  accountId: string;
  employeeId: string;
}>;

/** Account-level lock operations exposed to authenticated routes. */
export type AccountLockService = Readonly<{
  lockAccount(command: LockAccountCommand): Promise<AccountLockResponse>;
  unlockAccount(command: UnlockAccountCommand): Promise<void>;
}>;
