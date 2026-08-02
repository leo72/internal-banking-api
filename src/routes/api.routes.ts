import { Router } from "express";

import { createAccountRouter } from "../modules/accounts/account.routes.js";
import type { AccountService } from "../modules/accounts/types/account.types.js";
import { createTransferRouter } from "../modules/transfers/transfer.routes.js";
import type { TransferService } from "../modules/transfers/types/transfer.types.js";

type ApiServices = Readonly<{
  accountService: AccountService;
  transferService: TransferService;
}>;

/** Aggregates version-one business routes and their dependencies. */
export function createApiRouter(services: ApiServices): Router {
  const router = Router();
  router.use(createAccountRouter(services.accountService));
  router.use(createTransferRouter(services.transferService));
  return router;
}
