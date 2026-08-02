import { Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import { AccountIdParamsSchema } from "../accounts/account.schemas.js";
import type { AccountIdParams } from "../accounts/types/account.types.js";
import { requireAuthenticatedEmployee } from "../auth/auth.context.js";
import { CreateAccountCommentBodySchema } from "./account-comment.schemas.js";
import type {
  AccountCommentResponse,
  AccountCommentService,
  CreateAccountCommentBody,
} from "./types/account-comment.types.js";

/** Exposes internal comment creation for individual accounts. */
export function createAccountCommentRouter(
  service: AccountCommentService,
): Router {
  const router = Router();

  router.post<
    AccountIdParams,
    AccountCommentResponse,
    CreateAccountCommentBody
  >(
    "/accounts/:accountId/comments",
    validateRequest("params", AccountIdParamsSchema),
    validateRequest("body", CreateAccountCommentBodySchema),
    async (request, response) => {
      const employee = requireAuthenticatedEmployee(
        response.locals.employee,
      );
      const comment = await service.createComment({
        accountId: request.params.accountId,
        body: request.body.body,
        employeeId: employee.id,
      });
      response.status(201).json(comment);
    },
  );

  return router;
}
