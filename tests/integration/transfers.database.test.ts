import "dotenv/config";

import { jest } from "@jest/globals";
import type { Express } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { createPrismaClient } from "../../src/db/prisma.js";
import { hashApiKey } from "../../src/lib/api-key.js";
import { sha256 } from "../../src/lib/hash.js";
import { createAccountCommentService } from "../../src/modules/account-comments/account-comment.service.js";
import { createAccountLockService } from "../../src/modules/account-locks/account-lock.service.js";
import { createAccountService } from "../../src/modules/accounts/account.service.js";
import {
  createEmployeeApiKeyLookup,
  createEmployeeAuthentication,
} from "../../src/modules/auth/auth.middleware.js";
import { InProcessTransferQueue } from "../../src/modules/transfers/transfer.queue.js";
import { createTransferRepository } from "../../src/modules/transfers/transfer.repository.js";
import { createTransferService } from "../../src/modules/transfers/transfer.service.js";
import type { ExecuteTransferCommand } from "../../src/modules/transfers/types/transfer.types.js";
import { createApiRouter } from "../../src/routes/api.routes.js";

const API_KEY_PEPPER = "database-test-api-key-pepper-32-characters";
const EMPLOYEE_ONE_KEY = "database-test-employee-key-000001";
const EMPLOYEE_TWO_KEY = "database-test-employee-key-000002";
const EMPLOYEE_ONE_ID = "10000000-0000-4000-8000-000000000001";
const EMPLOYEE_TWO_ID = "10000000-0000-4000-8000-000000000002";
const CUSTOMER_ONE_ID = 2_000_000_001;
const CUSTOMER_TWO_ID = 2_000_000_002;
const SOURCE_ACCOUNT_ID = "a0000000-0000-4000-8000-000000000001";
const DESTINATION_ONE_ID = "a0000000-0000-4000-8000-000000000002";
const DESTINATION_TWO_ID = "a0000000-0000-4000-8000-000000000003";
const TEST_ACCOUNT_IDS = [
  SOURCE_ACCOUNT_ID,
  DESTINATION_ONE_ID,
  DESTINATION_TWO_ID,
];
const TEST_EMPLOYEE_IDS = [EMPLOYEE_ONE_ID, EMPLOYEE_TWO_ID];

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for transfer database tests");
}

const database = createPrismaClient(databaseUrl);
const accountCommentService = createAccountCommentService(database);
const accountLockService = createAccountLockService(database);
const transferRepository = createTransferRepository(database);
let app: Express;

const testTransferFilter = {
  OR: [
    { initiatedByEmployeeId: { in: TEST_EMPLOYEE_IDS } },
    { sourceAccountId: { in: TEST_ACCOUNT_IDS } },
    { destinationAccountId: { in: TEST_ACCOUNT_IDS } },
  ],
};

/** Deletes only records owned by this test fixture. */
async function cleanTransferFixture(): Promise<void> {
  await database.idempotencyRecord.deleteMany({
    where: { createdByEmployeeId: { in: TEST_EMPLOYEE_IDS } },
  });
  await database.transfer.deleteMany({
    where: testTransferFilter,
  });
  await database.accountLock.deleteMany({
    where: { accountId: { in: TEST_ACCOUNT_IDS } },
  });
  await database.accountComment.deleteMany({
    where: { accountId: { in: TEST_ACCOUNT_IDS } },
  });
  await database.account.deleteMany({
    where: { id: { in: TEST_ACCOUNT_IDS } },
  });
  await database.customer.deleteMany({
    where: { id: { in: [CUSTOMER_ONE_ID, CUSTOMER_TWO_ID] } },
  });
  await database.employee.deleteMany({
    where: { id: { in: TEST_EMPLOYEE_IDS } },
  });
}

/** Creates employees and funded accounts for one isolated test. */
async function seedTransferFixture(): Promise<void> {
  await database.employee.createMany({
    data: [
      {
        id: EMPLOYEE_ONE_ID,
        name: "Database Employee One",
        apiKeyHash: hashApiKey(EMPLOYEE_ONE_KEY, API_KEY_PEPPER),
      },
      {
        id: EMPLOYEE_TWO_ID,
        name: "Database Employee Two",
        apiKeyHash: hashApiKey(EMPLOYEE_TWO_KEY, API_KEY_PEPPER),
      },
    ],
  });
  await database.customer.createMany({
    data: [
      { id: CUSTOMER_ONE_ID, name: "Transfer Test Customer One" },
      { id: CUSTOMER_TWO_ID, name: "Transfer Test Customer Two" },
    ],
  });
  await database.account.createMany({
    data: [
      {
        id: SOURCE_ACCOUNT_ID,
        customerId: CUSTOMER_ONE_ID,
        currency: "USD",
        initialDepositMinor: 150_000n,
        balanceMinor: 150_000n,
      },
      {
        id: DESTINATION_ONE_ID,
        customerId: CUSTOMER_TWO_ID,
        currency: "USD",
        initialDepositMinor: 0n,
        balanceMinor: 0n,
      },
      {
        id: DESTINATION_TWO_ID,
        customerId: CUSTOMER_ONE_ID,
        currency: "USD",
        initialDepositMinor: 0n,
        balanceMinor: 0n,
      },
    ],
  });
}

/** Builds the normalized command used to test the repository without its queue. */
function createExecutionCommand(
  sourceAccountId: string,
  destinationAccountId: string,
  amountMinor: bigint,
  employeeId: string,
  idempotencyKey: string,
): ExecuteTransferCommand {
  return {
    sourceAccountId,
    destinationAccountId,
    amountMinor,
    employeeId,
    idempotencyKeyHash: sha256(idempotencyKey),
    requestHash: sha256(
      JSON.stringify({
        sourceAccountId,
        destinationAccountId,
        amountMinor: amountMinor.toString(),
      }),
    ),
  };
}

/** Submits one authenticated HTTP transfer. */
function postTransfer(
  employeeApiKey: string,
  idempotencyKey: string,
  destinationAccountId: string,
  amount: string,
  sourceAccountId = SOURCE_ACCOUNT_ID,
) {
  return request(app)
    .post("/v1/transfers")
    .set("Authorization", `Bearer ${employeeApiKey}`)
    .set("Idempotency-Key", idempotencyKey)
    .send({
      sourceAccountId,
      destinationAccountId,
      amount,
    });
}

jest.setTimeout(30_000);

beforeAll(async () => {
  await database.$connect();
  const authenticateEmployee = createEmployeeAuthentication({
    apiKeyPepper: API_KEY_PEPPER,
    findEmployeeByApiKeyHash: createEmployeeApiKeyLookup(database),
  });
  const transferService = createTransferService(
    transferRepository,
    new InProcessTransferQueue(),
  );
  app = createApp({
    apiRouter: createApiRouter({
      accountCommentService,
      accountLockService,
      accountService: createAccountService(database),
      transferService,
    }),
    authenticateEmployee,
    nodeEnv: "test",
  });
});

beforeEach(async () => {
  await cleanTransferFixture();
  await seedTransferFixture();
});

afterAll(async () => {
  await cleanTransferFixture();
  await database.$disconnect();
});

describe("transfer database integration", () => {
  it("commits one audited transfer and replays it across employees", async () => {
    const first = await postTransfer(
      EMPLOYEE_ONE_KEY,
      "database-replay-key-0001",
      DESTINATION_ONE_ID,
      "100.00",
    ).expect(201);
    const replay = await postTransfer(
      EMPLOYEE_TWO_KEY,
      "database-replay-key-0001",
      DESTINATION_ONE_ID,
      "100",
    ).expect(201);
    const mismatch = await postTransfer(
      EMPLOYEE_TWO_KEY,
      "database-replay-key-0001",
      DESTINATION_ONE_ID,
      "101.00",
    ).expect(409);

    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body).toEqual(first.body);
    expect(mismatch.body.code).toBe("IDEMPOTENCY_KEY_REUSED");

    const transfers = await database.transfer.findMany({
      where: testTransferFilter,
    });
    const idempotencyRecord = await database.idempotencyRecord.findFirstOrThrow({
      where: { transferId: first.body.id },
    });
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.initiatedByEmployeeId).toBe(EMPLOYEE_ONE_ID);
    expect(idempotencyRecord.createdByEmployeeId).toBe(EMPLOYEE_ONE_ID);

    const outgoingHistory = await request(app)
      .get(`/v1/accounts/${SOURCE_ACCOUNT_ID}/transfers`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(200);
    const incomingHistory = await request(app)
      .get(`/v1/accounts/${DESTINATION_ONE_ID}/transfers`)
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .expect(200);
    expect(outgoingHistory.body.transfers[0]).toMatchObject({
      id: first.body.id,
      direction: "OUTGOING",
      balanceAfter: "1400.00",
    });
    expect(incomingHistory.body.transfers[0]).toMatchObject({
      id: first.body.id,
      direction: "INCOMING",
      balanceAfter: "100.00",
    });
  });

  it("prevents two employees from concurrently overspending through HTTP", async () => {
    const responses = await Promise.all([
      postTransfer(
        EMPLOYEE_ONE_KEY,
        "database-concurrent-key-0001",
        DESTINATION_ONE_ID,
        "1000.00",
      ),
      postTransfer(
        EMPLOYEE_TWO_KEY,
        "database-concurrent-key-0002",
        DESTINATION_TWO_ID,
        "1000.00",
      ),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 422,
    ]);
    expect(
      responses.find((response) => response.status === 422)?.body.code,
    ).toBe("INSUFFICIENT_FUNDS");

    const source = await database.account.findUniqueOrThrow({
      where: { id: SOURCE_ACCOUNT_ID },
    });
    const attempts = await database.idempotencyRecord.findMany({
      where: { createdByEmployeeId: { in: TEST_EMPLOYEE_IDS } },
      orderBy: { createdByEmployeeId: "asc" },
    });
    expect(source.balanceMinor).toBe(50_000n);
    expect(
      await database.transfer.count({ where: testTransferFilter }),
    ).toBe(1);
    expect(attempts.map((attempt) => attempt.createdByEmployeeId)).toEqual(
      TEST_EMPLOYEE_IDS,
    );
  });

  it("preserves the overspending guarantee when bypassing the FIFO queue", async () => {
    const results = await Promise.all([
      transferRepository.executeTransfer(
        createExecutionCommand(
          SOURCE_ACCOUNT_ID,
          DESTINATION_ONE_ID,
          100_000n,
          EMPLOYEE_ONE_ID,
          "database-direct-key-0001",
        ),
      ),
      transferRepository.executeTransfer(
        createExecutionCommand(
          SOURCE_ACCOUNT_ID,
          DESTINATION_TWO_ID,
          100_000n,
          EMPLOYEE_TWO_ID,
          "database-direct-key-0002",
        ),
      ),
    ]);

    expect(results.map((result) => result.statusCode).sort()).toEqual([
      201, 422,
    ]);
    const source = await database.account.findUniqueOrThrow({
      where: { id: SOURCE_ACCOUNT_ID },
    });
    expect(source.balanceMinor).toBe(50_000n);
    expect(
      await database.transfer.count({ where: testTransferFilter }),
    ).toBe(1);
  });

  it("stores deterministic transfer validation failures without moving funds", async () => {
    const sameAccount = await postTransfer(
      EMPLOYEE_ONE_KEY,
      "database-invalid-key-0001",
      SOURCE_ACCOUNT_ID,
      "10.00",
    ).expect(422);
    const zeroAmount = await postTransfer(
      EMPLOYEE_ONE_KEY,
      "database-invalid-key-0002",
      DESTINATION_ONE_ID,
      "0.00",
    ).expect(422);
    await database.account.update({
      where: { id: DESTINATION_ONE_ID },
      data: { currency: "EUR" },
    });
    const currencyMismatch = await postTransfer(
      EMPLOYEE_TWO_KEY,
      "database-invalid-key-0003",
      DESTINATION_ONE_ID,
      "10.00",
    ).expect(422);

    expect(sameAccount.body.code).toBe("SAME_ACCOUNT_TRANSFER");
    expect(zeroAmount.body.code).toBe("INVALID_TRANSFER_AMOUNT");
    expect(currencyMismatch.body.code).toBe("CURRENCY_MISMATCH");
    expect(
      await database.transfer.count({ where: testTransferFilter }),
    ).toBe(0);
    const source = await database.account.findUniqueOrThrow({
      where: { id: SOURCE_ACCOUNT_ID },
    });
    expect(source.balanceMinor).toBe(150_000n);
  });

  it("completes opposite-direction transfers without deadlocking", async () => {
    await database.account.update({
      where: { id: DESTINATION_ONE_ID },
      data: { balanceMinor: 100_000n },
    });

    const results = await Promise.all([
      transferRepository.executeTransfer(
        createExecutionCommand(
          SOURCE_ACCOUNT_ID,
          DESTINATION_ONE_ID,
          10_000n,
          EMPLOYEE_ONE_ID,
          "database-opposite-key-0001",
        ),
      ),
      transferRepository.executeTransfer(
        createExecutionCommand(
          DESTINATION_ONE_ID,
          SOURCE_ACCOUNT_ID,
          5_000n,
          EMPLOYEE_TWO_ID,
          "database-opposite-key-0002",
        ),
      ),
    ]);

    expect(results.map((result) => result.statusCode)).toEqual([201, 201]);
    const accounts = await database.account.findMany({
      where: { id: { in: [SOURCE_ACCOUNT_ID, DESTINATION_ONE_ID] } },
      orderBy: { id: "asc" },
    });
    expect(
      accounts.reduce((total, account) => total + account.balanceMinor, 0n),
    ).toBe(250_000n);
    expect(accounts.find((account) => account.id === SOURCE_ACCOUNT_ID)?.balanceMinor)
      .toBe(145_000n);
  });

  it("rejects and replays transfers involving an active account lock", async () => {
    await database.accountLock.create({
      data: {
        accountId: DESTINATION_ONE_ID,
        reason: "Database transfer test",
        lockedByEmployeeId: EMPLOYEE_ONE_ID,
      },
    });

    const first = await postTransfer(
      EMPLOYEE_ONE_KEY,
      "database-locked-key-0001",
      DESTINATION_ONE_ID,
      "100.00",
    ).expect(423);
    const replay = await postTransfer(
      EMPLOYEE_TWO_KEY,
      "database-locked-key-0001",
      DESTINATION_ONE_ID,
      "100.00",
    ).expect(423);

    expect(first.body.code).toBe("ACCOUNT_LOCKED");
    expect(replay.body).toEqual(first.body);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(
      await database.transfer.count({ where: testTransferFilter }),
    ).toBe(0);
  });
});

describe("account lock database integration", () => {
  it("records employee attribution when locking and unlocking an account", async () => {
    const created = await request(app)
      .post(`/v1/accounts/${SOURCE_ACCOUNT_ID}/locks`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .send({ reason: "  Manual fraud review  " })
      .expect(201);

    expect(created.body).toMatchObject({
      accountId: SOURCE_ACCOUNT_ID,
      reason: "Manual fraud review",
      lockedByEmployeeId: EMPLOYEE_ONE_ID,
      unlockedByEmployeeId: null,
      unlockedAt: null,
    });
    const duplicate = await request(app)
      .post(`/v1/accounts/${SOURCE_ACCOUNT_ID}/locks`)
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .send({ reason: "Duplicate review" })
      .expect(409);
    expect(duplicate.body.code).toBe("ACCOUNT_ALREADY_LOCKED");
    const lockedBalance = await request(app)
      .get(`/v1/accounts/${SOURCE_ACCOUNT_ID}/balance`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(200);
    expect(lockedBalance.body.isLocked).toBe(true);

    await request(app)
      .delete(`/v1/accounts/${SOURCE_ACCOUNT_ID}/locks`)
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .expect(204);
    await request(app)
      .delete(`/v1/accounts/${SOURCE_ACCOUNT_ID}/locks`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(204);

    const storedLock = await database.accountLock.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(storedLock.unlockedByEmployeeId).toBe(EMPLOYEE_TWO_ID);
    expect(storedLock.unlockedAt).not.toBeNull();
    const unlockedBalance = await request(app)
      .get(`/v1/accounts/${SOURCE_ACCOUNT_ID}/balance`)
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .expect(200);
    expect(unlockedBalance.body.isLocked).toBe(false);
  });

  it("keeps locks isolated between accounts owned by the same customer", async () => {
    await database.account.update({
      where: { id: DESTINATION_TWO_ID },
      data: { balanceMinor: 50_000n },
    });
    await request(app)
      .post(`/v1/accounts/${SOURCE_ACCOUNT_ID}/locks`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .send({ reason: "Source account review" })
      .expect(201);

    const blocked = await postTransfer(
      EMPLOYEE_ONE_KEY,
      "database-isolation-key-0001",
      DESTINATION_ONE_ID,
      "100.00",
    ).expect(423);
    const allowed = await postTransfer(
      EMPLOYEE_TWO_KEY,
      "database-isolation-key-0002",
      DESTINATION_ONE_ID,
      "100.00",
      DESTINATION_TWO_ID,
    ).expect(201);

    expect(blocked.body.code).toBe("ACCOUNT_LOCKED");
    expect(allowed.body.sourceAccountId).toBe(DESTINATION_TWO_ID);
  });

  it("allows only one concurrent active lock for an account", async () => {
    const results = await Promise.allSettled([
      accountLockService.lockAccount({
        accountId: SOURCE_ACCOUNT_ID,
        reason: "Employee one review",
        employeeId: EMPLOYEE_ONE_ID,
      }),
      accountLockService.lockAccount({
        accountId: SOURCE_ACCOUNT_ID,
        reason: "Employee two review",
        employeeId: EMPLOYEE_TWO_ID,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(
      await database.accountLock.count({
        where: { accountId: SOURCE_ACCOUNT_ID, unlockedAt: null },
      }),
    ).toBe(1);
  });

  it("serializes a lock racing a transfer into one valid outcome", async () => {
    const [, transferResult] = await Promise.all([
      accountLockService.lockAccount({
        accountId: SOURCE_ACCOUNT_ID,
        reason: "Concurrent review",
        employeeId: EMPLOYEE_ONE_ID,
      }),
      transferRepository.executeTransfer(
        createExecutionCommand(
          SOURCE_ACCOUNT_ID,
          DESTINATION_ONE_ID,
          10_000n,
          EMPLOYEE_TWO_ID,
          "database-lock-race-key-0001",
        ),
      ),
    ]);

    expect([201, 423]).toContain(transferResult.statusCode);
    const source = await database.account.findUniqueOrThrow({
      where: { id: SOURCE_ACCOUNT_ID },
    });
    expect(source.balanceMinor).toBe(
      transferResult.statusCode === 201 ? 140_000n : 150_000n,
    );
    expect(
      await database.accountLock.count({
        where: { accountId: SOURCE_ACCOUNT_ID, unlockedAt: null },
      }),
    ).toBe(1);
  });
});

describe("account comment database integration", () => {
  it("keeps employee-attributed comments isolated to their accounts", async () => {
    const sourceComment = await request(app)
      .post(`/v1/accounts/${SOURCE_ACCOUNT_ID}/comments`)
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .send({ body: "  Source account review note  " })
      .expect(201);
    const destinationComment = await request(app)
      .post(`/v1/accounts/${DESTINATION_TWO_ID}/comments`)
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .send({ body: "Destination account review note" })
      .expect(201);

    expect(sourceComment.body).toMatchObject({
      accountId: SOURCE_ACCOUNT_ID,
      body: "Source account review note",
      createdByEmployeeId: EMPLOYEE_ONE_ID,
    });
    expect(destinationComment.body).toMatchObject({
      accountId: DESTINATION_TWO_ID,
      body: "Destination account review note",
      createdByEmployeeId: EMPLOYEE_TWO_ID,
    });

    const sourceComments = await database.accountComment.findMany({
      where: { accountId: SOURCE_ACCOUNT_ID },
    });
    const destinationComments = await database.accountComment.findMany({
      where: { accountId: DESTINATION_TWO_ID },
    });
    expect(sourceComments).toHaveLength(1);
    expect(sourceComments[0]?.createdByEmployeeId).toBe(EMPLOYEE_ONE_ID);
    expect(destinationComments).toHaveLength(1);
    expect(destinationComments[0]?.createdByEmployeeId).toBe(
      EMPLOYEE_TWO_ID,
    );
  });

  it("rejects comments for an account that does not exist", async () => {
    const response = await request(app)
      .post("/v1/accounts/a0000000-0000-4000-8000-999999999999/comments")
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .send({ body: "Unattached review note" })
      .expect(404);

    expect(response.body.code).toBe("ACCOUNT_NOT_FOUND");
  });
});
