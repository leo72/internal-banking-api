import { jest } from "@jest/globals";
import type { RequestHandler } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { AppError } from "../../src/errors/app-error.js";
import type { AccountCommentService } from "../../src/modules/account-comments/types/account-comment.types.js";
import type { AccountLockService } from "../../src/modules/account-locks/types/account-lock.types.js";
import type {
  AccountBalanceResponse,
  AccountResponse,
  AccountService,
} from "../../src/modules/accounts/types/account.types.js";
import type { TransferService } from "../../src/modules/transfers/types/transfer.types.js";
import { createApiRouter } from "../../src/routes/api.routes.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

const ACCOUNT_RESPONSE = {
  id: ACCOUNT_ID,
  customerId: 1,
  currency: "USD",
  initialDeposit: "1000.00",
  balance: "1000.00",
  createdAt: "2026-08-02T12:00:00.000Z",
} satisfies AccountResponse;

const BALANCE_RESPONSE = {
  accountId: ACCOUNT_ID,
  currency: "USD",
  balance: "1000.00",
  isLocked: false,
} satisfies AccountBalanceResponse;

const unusedTransferService = {
  async createTransfer() {
    throw new Error("Transfer route is not used by account tests");
  },
  async getAccountHistory(accountId) {
    return { accountId, transfers: [] };
  },
} satisfies TransferService;

const unusedAccountLockService = {
  async lockAccount() {
    throw new Error("Account lock route is not used by account tests");
  },
  async unlockAccount() {
    throw new Error("Account unlock route is not used by account tests");
  },
} satisfies AccountLockService;

const unusedAccountCommentService = {
  async createComment() {
    throw new Error("Account comment route is not used by account tests");
  },
} satisfies AccountCommentService;

const allowAuthenticatedTestRequest: RequestHandler = (
  _request,
  response,
  next,
) => {
  response.locals.employee = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Alex Morgan",
  };
  next();
};

/** Creates an account HTTP app with observable service test doubles. */
function createAccountTestFixture() {
  const createAccount = jest.fn(async () => ACCOUNT_RESPONSE);
  const getAccountBalance = jest.fn(async () => BALANCE_RESPONSE);
  const accountService = {
    createAccount,
    getAccountBalance,
  } satisfies AccountService;
  const app = createApp({
    apiRouter: createApiRouter({
      accountCommentService: unusedAccountCommentService,
      accountLockService: unusedAccountLockService,
      accountService,
      transferService: unusedTransferService,
    }),
    authenticateEmployee: allowAuthenticatedTestRequest,
    nodeEnv: "test",
  });

  return { app, createAccount, getAccountBalance };
}

describe("account routes", () => {
  it("creates an account with an exact decimal initial deposit", async () => {
    const { app, createAccount } = createAccountTestFixture();

    const response = await request(app)
      .post("/v1/customers/1/accounts")
      .send({ currency: "USD", initialDeposit: "1000.00" })
      .expect(201);

    expect(response.body).toEqual(ACCOUNT_RESPONSE);
    expect(createAccount).toHaveBeenCalledWith({
      customerId: 1,
      currency: "USD",
      initialDeposit: "1000.00",
    });
  });

  it.each([
    { currency: "usd", initialDeposit: "1000.00" },
    { currency: "USD", initialDeposit: -1 },
    { currency: "USD", initialDeposit: "-1.00" },
    { currency: "USD", initialDeposit: "1.001" },
    { currency: "USD", initialDeposit: "1.00", unexpected: true },
  ])("rejects invalid account input %#", async (body) => {
    const { app, createAccount } = createAccountTestFixture();

    const response = await request(app)
      .post("/v1/customers/1/accounts")
      .send(body)
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("returns a stable error when the customer does not exist", async () => {
    const { app, createAccount } = createAccountTestFixture();
    createAccount.mockRejectedValueOnce(
      new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found"),
    );

    const response = await request(app)
      .post("/v1/customers/999/accounts")
      .send({ currency: "USD", initialDeposit: "10.00" })
      .expect(404);

    expect(response.body).toEqual({
      status: 404,
      code: "CUSTOMER_NOT_FOUND",
      message: "Customer not found",
    });
  });

  it("retrieves an account balance", async () => {
    const { app, getAccountBalance } = createAccountTestFixture();

    const response = await request(app)
      .get(`/v1/accounts/${ACCOUNT_ID}/balance`)
      .expect(200);

    expect(response.body).toEqual(BALANCE_RESPONSE);
    expect(getAccountBalance).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("rejects an invalid account identifier before service execution", async () => {
    const { app, getAccountBalance } = createAccountTestFixture();

    const response = await request(app)
      .get("/v1/accounts/not-a-uuid/balance")
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(getAccountBalance).not.toHaveBeenCalled();
  });
});
