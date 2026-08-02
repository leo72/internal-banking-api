import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import {
  createLogger,
  serializeRequestForLog,
  serializeResponseForLog,
} from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { apiRouter } from "./routes/api.routes.js";

export type CreateAppOptions = Readonly<{
  authenticateEmployee: RequestHandler;
  logger?: Logger;
  nodeEnv?: string;
}>;

/** Builds the Express application without opening a network listener. */
export function createApp(options: CreateAppOptions): Express {
  const app = express();
  const logger = options.logger ?? createLogger(options.nodeEnv ?? "development");

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: serializeRequestForLog,
        res: serializeResponseForLog,
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter);
  app.use("/v1", options.authenticateEmployee, apiRouter);

  app.use((request, response) => {
    response.status(404).json({
      status: 404,
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      path: request.path,
    });
  });
  app.use(errorHandler);

  return app;
}
