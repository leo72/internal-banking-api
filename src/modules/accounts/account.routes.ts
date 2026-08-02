import { Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import {
  AccountIdParamsSchema,
  CreateAccountBodySchema,
  CustomerAccountParamsSchema,
} from "./account.schemas.js";
import type {
  AccountBalanceResponse,
  AccountIdParams,
  AccountResponse,
  AccountService,
  CreateAccountBody,
  CustomerAccountParams,
} from "./types/account.types.js";

/** Creates account creation and balance routes. */
export function createAccountRouter(accountService: AccountService): Router {
  const router = Router();

  router.post<CustomerAccountParams, AccountResponse, CreateAccountBody>(
    "/customers/:customerId/accounts",
    validateRequest("params", CustomerAccountParamsSchema),
    validateRequest("body", CreateAccountBodySchema),
    async (request, response) => {
      const account = await accountService.createAccount({
        customerId: Number(request.params.customerId),
        currency: request.body.currency,
        initialDeposit: request.body.initialDeposit,
      });
      response.status(201).json(account);
    },
  );

  router.get<AccountIdParams, AccountBalanceResponse>(
    "/accounts/:accountId/balance",
    validateRequest("params", AccountIdParamsSchema),
    async (request, response) => {
      const balance = await accountService.getAccountBalance(
        request.params.accountId,
      );
      response.status(200).json(balance);
    },
  );

  return router;
}
