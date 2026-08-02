import { jest } from "@jest/globals";
import type { RequestHandler } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { createTransferRouter } from "../../src/modules/transfers/transfer.routes.js";
import type {
  CreateTransferCommand,
  TransferExecutionResult,
  TransferHistoryResponse,
  TransferService,
} from "../../src/modules/transfers/types/transfer.types.js";

const SOURCE_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const DESTINATION_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "00000000-0000-4000-8000-000000000001";

const TRANSFER_RESPONSE = {
  id: "33333333-3333-4333-8333-333333333333",
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amount: "100.00",
  currency: "USD",
  sourceBalanceAfter: "900.00",
  destinationBalanceAfter: "100.00",
  initiatedByEmployeeId: EMPLOYEE_ID,
  createdAt: "2026-08-02T12:00:00.000Z",
};

const authenticateEmployee: RequestHandler = (_request, response, next) => {
  response.locals.employee = { id: EMPLOYEE_ID, name: "Alex Morgan" };
  next();
};

/** Creates a transfer HTTP app with observable service test doubles. */
function createTransferTestFixture(
  executionResult: TransferExecutionResult = {
    statusCode: 201,
    body: TRANSFER_RESPONSE,
    isReplay: false,
  },
) {
  const createTransfer = jest.fn(async (command: CreateTransferCommand) => {
    void command;
    return executionResult;
  });
  const history = {
    accountId: SOURCE_ACCOUNT_ID,
    transfers: [],
  } satisfies TransferHistoryResponse;
  const getAccountHistory = jest.fn(async (accountId: string) => {
    void accountId;
    return history;
  });
  const service = {
    createTransfer,
    getAccountHistory,
  } satisfies TransferService;
  const app = createApp({
    apiRouter: createTransferRouter(service),
    authenticateEmployee,
    nodeEnv: "test",
  });

  return { app, createTransfer, getAccountHistory };
}

describe("transfer routes", () => {
  it("submits an authenticated transfer with its idempotency key", async () => {
    const { app, createTransfer } = createTransferTestFixture();

    const response = await request(app)
      .post("/v1/transfers")
      .set("Idempotency-Key", "transfer-request-0001")
      .send({
        sourceAccountId: SOURCE_ACCOUNT_ID,
        destinationAccountId: DESTINATION_ACCOUNT_ID,
        amount: "100.00",
      })
      .expect(201);

    expect(response.body).toEqual(TRANSFER_RESPONSE);
    expect(createTransfer).toHaveBeenCalledWith({
      sourceAccountId: SOURCE_ACCOUNT_ID,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amount: "100.00",
      employeeId: EMPLOYEE_ID,
      idempotencyKey: "transfer-request-0001",
    });
  });

  it("requires a valid idempotency key before calling the service", async () => {
    const { app, createTransfer } = createTransferTestFixture();
    const body = {
      sourceAccountId: SOURCE_ACCOUNT_ID,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amount: "100.00",
    };

    const missing = await request(app)
      .post("/v1/transfers")
      .send(body)
      .expect(400);
    const invalid = await request(app)
      .post("/v1/transfers")
      .set("Idempotency-Key", "short")
      .send(body)
      .expect(400);

    expect(missing.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(invalid.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("marks a replayed response without changing its stored status or body", async () => {
    const replay = {
      statusCode: 201,
      body: TRANSFER_RESPONSE,
      isReplay: true,
    } satisfies TransferExecutionResult;
    const { app } = createTransferTestFixture(replay);

    const response = await request(app)
      .post("/v1/transfers")
      .set("Idempotency-Key", "transfer-request-0002")
      .send({
        sourceAccountId: SOURCE_ACCOUNT_ID,
        destinationAccountId: DESTINATION_ACCOUNT_ID,
        amount: "100.00",
      })
      .expect(201);

    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(response.body).toEqual(TRANSFER_RESPONSE);
  });

  it("retrieves transfer history for one account", async () => {
    const { app, getAccountHistory } = createTransferTestFixture();

    const response = await request(app)
      .get(`/v1/accounts/${SOURCE_ACCOUNT_ID}/transfers`)
      .expect(200);

    expect(response.body).toEqual({
      accountId: SOURCE_ACCOUNT_ID,
      transfers: [],
    });
    expect(getAccountHistory).toHaveBeenCalledWith(SOURCE_ACCOUNT_ID);
  });
});
