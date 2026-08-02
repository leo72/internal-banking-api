import type { Static } from "@sinclair/typebox";

import type {
  AccountBalanceResponseSchema,
  AccountIdParamsSchema,
  AccountResponseSchema,
  CreateAccountBodySchema,
  CustomerAccountParamsSchema,
} from "../account.schemas.js";

export type CreateAccountBody = Static<typeof CreateAccountBodySchema>;
export type CustomerAccountParams = Static<typeof CustomerAccountParamsSchema>;
export type AccountIdParams = Static<typeof AccountIdParamsSchema>;
export type AccountResponse = Static<typeof AccountResponseSchema>;
export type AccountBalanceResponse = Static<
  typeof AccountBalanceResponseSchema
>;

export type CreateAccountCommand = CreateAccountBody &
  Readonly<{
    customerId: number;
  }>;

/** Account operations exposed to HTTP route handlers. */
export type AccountService = Readonly<{
  createAccount(command: CreateAccountCommand): Promise<AccountResponse>;
  getAccountBalance(accountId: string): Promise<AccountBalanceResponse>;
}>;
