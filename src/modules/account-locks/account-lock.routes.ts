import { Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import { AccountIdParamsSchema } from "../accounts/account.schemas.js";
import type { AccountIdParams } from "../accounts/types/account.types.js";
import { requireAuthenticatedEmployee } from "../auth/auth.context.js";
import { CreateAccountLockBodySchema } from "./account-lock.schemas.js";
import type {
  AccountLockResponse,
  AccountLockService,
  CreateAccountLockBody,
} from "./types/account-lock.types.js";

/** Exposes account-only lock creation and idempotent lock removal. */
export function createAccountLockRouter(
  service: AccountLockService,
): Router {
  const router = Router();

  router.post<
    AccountIdParams,
    AccountLockResponse,
    CreateAccountLockBody
  >(
    "/accounts/:accountId/locks",
    validateRequest("params", AccountIdParamsSchema),
    validateRequest("body", CreateAccountLockBodySchema),
    async (request, response) => {
      const employee = requireAuthenticatedEmployee(
        response.locals.employee,
      );
      const lock = await service.lockAccount({
        accountId: request.params.accountId,
        reason: request.body.reason,
        employeeId: employee.id,
      });
      response.status(201).json(lock);
    },
  );

  router.delete<AccountIdParams, void>(
    "/accounts/:accountId/locks",
    validateRequest("params", AccountIdParamsSchema),
    async (request, response) => {
      const employee = requireAuthenticatedEmployee(
        response.locals.employee,
      );
      await service.unlockAccount({
        accountId: request.params.accountId,
        employeeId: employee.id,
      });
      response.status(204).send();
    },
  );

  return router;
}
