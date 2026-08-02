import type { PrismaClient } from "../generated/prisma/client.js";

/** Shared database client contract used by application modules. */
export type DatabaseClient = PrismaClient;
