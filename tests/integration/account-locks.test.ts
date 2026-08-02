import { jest } from "@jest/globals";
import type { RequestHandler } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { AppError } from "../../src/errors/app-error.js";
import { createAccountLockRouter } from "../../src/modules/account-locks/account-lock.routes.js";
import type {
  AccountLockResponse,
  AccountLockService,
  LockAccountCommand,
  UnlockAccountCommand,
} from "../../src/modules/account-locks/types/account-lock.types.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_ID = "00000000-0000-4000-8000-000000000001";
const LOCK_RESPONSE = {
  id: "22222222-2222-4222-8222-222222222222",
  accountId: ACCOUNT_ID,
  reason: "Suspected fraud review",
  lockedByEmployeeId: EMPLOYEE_ID,
  lockedAt: "2026-08-02T12:00:00.000Z",
  unlockedByEmployeeId: null,
  unlockedAt: null,
} satisfies AccountLockResponse;

const authenticateEmployee: RequestHandler = (_request, response, next) => {
  response.locals.employee = { id: EMPLOYEE_ID, name: "Alex Morgan" };
  next();
};

/** Creates an account-lock HTTP app with observable service test doubles. */
function createAccountLockTestFixture() {
  const lockAccount = jest.fn(async (command: LockAccountCommand) => {
    void command;
    return LOCK_RESPONSE;
  });
  const unlockAccount = jest.fn(async (command: UnlockAccountCommand) => {
    void command;
  });
  const service = {
    lockAccount,
    unlockAccount,
  } satisfies AccountLockService;
  const app = createApp({
    apiRouter: createAccountLockRouter(service),
    authenticateEmployee,
    nodeEnv: "test",
  });

  return { app, lockAccount, unlockAccount };
}

describe("account lock routes", () => {
  it("creates an employee-attributed lock for one account", async () => {
    const { app, lockAccount } = createAccountLockTestFixture();

    const response = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/locks`)
      .send({ reason: "Suspected fraud review" })
      .expect(201);

    expect(response.body).toEqual(LOCK_RESPONSE);
    expect(lockAccount).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      reason: "Suspected fraud review",
      employeeId: EMPLOYEE_ID,
    });
  });

  it("rejects invalid lock reasons before calling the service", async () => {
    const { app, lockAccount } = createAccountLockTestFixture();

    const emptyReason = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/locks`)
      .send({ reason: "" })
      .expect(400);
    const unexpectedProperty = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/locks`)
      .send({ reason: "Review", customerId: 1 })
      .expect(400);

    expect(emptyReason.body.code).toBe("VALIDATION_ERROR");
    expect(unexpectedProperty.body.code).toBe("VALIDATION_ERROR");
    expect(lockAccount).not.toHaveBeenCalled();
  });

  it("removes the active lock idempotently", async () => {
    const { app, unlockAccount } = createAccountLockTestFixture();

    await request(app)
      .delete(`/v1/accounts/${ACCOUNT_ID}/locks`)
      .expect(204);

    expect(unlockAccount).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      employeeId: EMPLOYEE_ID,
    });
  });

  it("returns a conflict when the account is already locked", async () => {
    const { app, lockAccount } = createAccountLockTestFixture();
    lockAccount.mockRejectedValueOnce(
      new AppError(
        409,
        "ACCOUNT_ALREADY_LOCKED",
        "Account already has an active lock",
      ),
    );

    const response = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/locks`)
      .send({ reason: "Second lock" })
      .expect(409);

    expect(response.body.code).toBe("ACCOUNT_ALREADY_LOCKED");
  });
});
