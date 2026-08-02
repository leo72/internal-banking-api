import { Router } from "express";

import { createAccountCommentRouter } from "../modules/account-comments/account-comment.routes.js";
import type { AccountCommentService } from "../modules/account-comments/types/account-comment.types.js";
import { createAccountLockRouter } from "../modules/account-locks/account-lock.routes.js";
import type { AccountLockService } from "../modules/account-locks/types/account-lock.types.js";
import { createAccountRouter } from "../modules/accounts/account.routes.js";
import type { AccountService } from "../modules/accounts/types/account.types.js";
import { createTransferRouter } from "../modules/transfers/transfer.routes.js";
import type { TransferService } from "../modules/transfers/types/transfer.types.js";

type ApiServices = Readonly<{
  accountCommentService: AccountCommentService;
  accountLockService: AccountLockService;
  accountService: AccountService;
  transferService: TransferService;
}>;

/** Aggregates version-one business routes and their dependencies. */
export function createApiRouter(services: ApiServices): Router {
  const router = Router();
  router.use(createAccountCommentRouter(services.accountCommentService));
  router.use(createAccountLockRouter(services.accountLockService));
  router.use(createAccountRouter(services.accountService));
  router.use(createTransferRouter(services.transferService));
  return router;
}
