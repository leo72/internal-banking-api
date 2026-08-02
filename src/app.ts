import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import {
  createLogger,
  serializeRequestForLog,
  serializeResponseForLog,
} from "./lib/logger.js";
import { healthRouter } from "./modules/health/health.routes.js";

export type CreateAppOptions = Readonly<{
  logger?: Logger;
  nodeEnv?: string;
}>;

/** Builds the Express application without opening a network listener. */
export function createApp(options: CreateAppOptions = {}): Express {
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

  app.use((request, response) => {
    response.status(404).json({
      status: 404,
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      path: request.path,
    });
  });

  return app;
}
