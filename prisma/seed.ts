import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashApiKey } from "../src/lib/api-key.js";
import { createLogger } from "../src/lib/logger.js";

const CUSTOMER_SEEDS = [
  { id: 1, name: "Arisha Barron" },
  { id: 2, name: "Branden Gibson" },
  { id: 3, name: "Rhonda Church" },
  { id: 4, name: "Georgina Hazel" },
] as const;

const EMPLOYEE_SEEDS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Alex Morgan",
    keyEnvironmentVariable: "SEED_EMPLOYEE_1_API_KEY",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Sam Rivera",
    keyEnvironmentVariable: "SEED_EMPLOYEE_2_API_KEY",
  },
] as const;

/** Reads a required seed setting without exposing its value. */
function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value;
}

/** Idempotently seeds the assignment customers and development employees. */
async function seedDatabase(): Promise<void> {
  const databaseUrl = requireEnvironmentVariable("DATABASE_URL");
  const apiKeyPepper = requireEnvironmentVariable("API_KEY_PEPPER");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  const logger = createLogger(process.env["NODE_ENV"] ?? "development");

  try {
    await prisma.$transaction([
      ...CUSTOMER_SEEDS.map((customer) =>
        prisma.customer.upsert({
          where: { id: customer.id },
          update: { name: customer.name },
          create: customer,
        }),
      ),
      ...EMPLOYEE_SEEDS.map((employee) => {
        const apiKey = requireEnvironmentVariable(
          employee.keyEnvironmentVariable,
        );
        const apiKeyHash = hashApiKey(apiKey, apiKeyPepper);

        return prisma.employee.upsert({
          where: { id: employee.id },
          update: {
            name: employee.name,
            apiKeyHash,
            isActive: true,
          },
          create: {
            id: employee.id,
            name: employee.name,
            apiKeyHash,
            isActive: true,
          },
        });
      }),
    ]);

    logger.info(
      {
        customerCount: CUSTOMER_SEEDS.length,
        employeeCount: EMPLOYEE_SEEDS.length,
      },
      "Database seed completed",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void seedDatabase().catch((error: unknown) => {
  const logger = createLogger(process.env["NODE_ENV"] ?? "development");
  logger.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Database seed failed",
  );
  process.exitCode = 1;
});
