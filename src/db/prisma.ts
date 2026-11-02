import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

const DATABASE_POOL_MAX_CONNECTIONS = 10;
const DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
const DATABASE_IDLE_TIMEOUT_MS = 30_000;

/** Creates a Prisma client backed by the PostgreSQL driver adapter. */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: DATABASE_POOL_MAX_CONNECTIONS,
    connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: DATABASE_IDLE_TIMEOUT_MS,
  });

  return new PrismaClient({ adapter });
}
