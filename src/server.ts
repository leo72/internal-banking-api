import "dotenv/config";

import { createApp } from "./app.js";
import { parseRuntimeConfig } from "./config/env.js";
import { createPrismaClient } from "./db/prisma.js";
import { createLogger } from "./lib/logger.js";
import {
  createEmployeeApiKeyLookup,
  createEmployeeAuthentication,
} from "./modules/auth/auth.middleware.js";

/** Returns a safe error classification without logging error details. */
function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/** Connects dependencies, starts HTTP listening, and registers shutdown hooks. */
async function startServer(): Promise<void> {
  const config = parseRuntimeConfig(process.env);
  const logger = createLogger(config.nodeEnv);
  const prisma = createPrismaClient(config.databaseUrl);

  await prisma.$connect();

  const authenticateEmployee = createEmployeeAuthentication({
    apiKeyPepper: config.apiKeyPepper,
    findEmployeeByApiKeyHash: createEmployeeApiKeyLookup(prisma),
  });
  const app = createApp({
    authenticateEmployee,
    logger,
    nodeEnv: config.nodeEnv,
  });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Banking API listening");
  });

  let isShuttingDown = false;

  /** Stops HTTP intake before releasing the database connection. */
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutting down banking API");

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await prisma.$disconnect();
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal).catch((error: unknown) => {
        logger.error(
          { errorName: getErrorName(error), signal },
          "Graceful shutdown failed",
        );
        process.exitCode = 1;
      });
    });
  }
}

void startServer().catch((error: unknown) => {
  const logger = createLogger(process.env["NODE_ENV"] ?? "development");
  logger.error(
    { errorName: getErrorName(error) },
    "Banking API failed to start",
  );
  process.exitCode = 1;
});
