import type { RequestHandler } from "express";
import type { Logger } from "pino";

/** Dependencies required to compose the Express application. */
export type CreateAppOptions = Readonly<{
  apiRouter: RequestHandler;
  authenticateEmployee: RequestHandler;
  checkReadiness?: () => Promise<void>;
  logger?: Logger;
  nodeEnv?: string;
}>;
