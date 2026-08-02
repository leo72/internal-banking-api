import { Router } from "express";

import { createAccountRouter } from "../modules/accounts/account.routes.js";
import type { AccountService } from "../modules/accounts/types/account.types.js";

/** Aggregates version-one business routes and their dependencies. */
export function createApiRouter(accountService: AccountService): Router {
  const router = Router();
  router.use(createAccountRouter(accountService));
  return router;
}
