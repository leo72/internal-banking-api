import "dotenv/config";

import { createServer, type Server } from "node:http";

import { createApp } from "./app.js";
import { parseRuntimeConfig } from "./config/env.js";
import { createPrismaClient } from "./db/prisma.js";
import { AppError } from "./errors/app-error.js";
import { createLogger } from "./lib/logger.js";
import { createAccountCommentService } from "./modules/account-comments/account-comment.service.js";
import { createAccountLockService } from "./modules/account-locks/account-lock.service.js";
import { createAccountService } from "./modules/accounts/account.service.js";
import {
  createEmployeeApiKeyLookup,
  createEmployeeAuthentication,
} from "./modules/auth/auth.middleware.js";
import { InProcessTransferQueue } from "./modules/transfers/transfer.queue.js";
import { createTransferRepository } from "./modules/transfers/transfer.repository.js";
import { createTransferService } from "./modules/transfers/transfer.service.js";
import { createApiRouter } from "./routes/api.routes.js";

const HTTP_REQUEST_TIMEOUT_MS = 30_000;
const HTTP_HEADERS_TIMEOUT_MS = 35_000;
const HTTP_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 20_000;

/** Returns a safe error classification without logging error details. */
function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/** Waits until the HTTP server is listening or fails to bind. */
function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
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
  const apiRouter = createApiRouter({
    accountCommentService: createAccountCommentService(prisma),
    accountLockService: createAccountLockService(prisma),
    accountService: createAccountService(prisma),
    transferService: createTransferService(
      createTransferRepository(prisma),
      new InProcessTransferQueue(),
    ),
  });
  const app = createApp({
    apiRouter,
    authenticateEmployee,
    checkReadiness: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error: unknown) {
        logger.error(
          { errorName: getErrorName(error) },
          "Readiness check failed",
        );
        throw new AppError(
          503,
          "SERVICE_UNAVAILABLE",
          "Database is unavailable",
        );
      }
    },
    logger,
    nodeEnv: config.nodeEnv,
  });
  const server = createServer(app);
  server.requestTimeout = HTTP_REQUEST_TIMEOUT_MS;
  server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;
  server.keepAliveTimeout = HTTP_KEEP_ALIVE_TIMEOUT_MS;
  try {
    await listen(server, config.port);
  } catch (error: unknown) {
    await prisma.$disconnect();
    throw error;
  }
  logger.info({ port: config.port }, "Banking API listening");

  let isShuttingDown = false;

  /** Stops HTTP intake before releasing the database connection. */
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutting down banking API");

    const timeout = setTimeout(() => {
      logger.error({ signal }, "Graceful shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    try {
      server.closeIdleConnections();
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
      process.exit(0);
    } catch (error: unknown) {
      logger.error(
        { errorName: getErrorName(error), signal },
        "Graceful shutdown failed",
      );
      process.exit(1);
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}

void startServer().catch((error: unknown) => {
  const logger = createLogger(process.env["NODE_ENV"] ?? "development");
  logger.error(
    { errorName: getErrorName(error) },
    "Banking API failed to start",
  );
  process.exit(1);
});
