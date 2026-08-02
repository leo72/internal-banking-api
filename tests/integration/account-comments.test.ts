import { jest } from "@jest/globals";
import type { RequestHandler } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { AppError } from "../../src/errors/app-error.js";
import { createAccountCommentRouter } from "../../src/modules/account-comments/account-comment.routes.js";
import type {
  AccountCommentResponse,
  AccountCommentService,
  CreateAccountCommentCommand,
} from "../../src/modules/account-comments/types/account-comment.types.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_ID = "00000000-0000-4000-8000-000000000001";
const COMMENT_RESPONSE = {
  id: "22222222-2222-4222-8222-222222222222",
  accountId: ACCOUNT_ID,
  body: "Customer supplied supporting documents",
  createdByEmployeeId: EMPLOYEE_ID,
  createdAt: "2026-08-02T12:00:00.000Z",
} satisfies AccountCommentResponse;

const authenticateEmployee: RequestHandler = (_request, response, next) => {
  response.locals.employee = { id: EMPLOYEE_ID, name: "Alex Morgan" };
  next();
};

/** Creates an account-comment HTTP app with an observable service double. */
function createAccountCommentTestFixture() {
  const createComment = jest.fn(
    async (command: CreateAccountCommentCommand) => {
      void command;
      return COMMENT_RESPONSE;
    },
  );
  const service = { createComment } satisfies AccountCommentService;
  const app = createApp({
    apiRouter: createAccountCommentRouter(service),
    authenticateEmployee,
    nodeEnv: "test",
  });

  return { app, createComment };
}

describe("account comment routes", () => {
  it("creates an employee-attributed comment for one account", async () => {
    const { app, createComment } = createAccountCommentTestFixture();

    const response = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/comments`)
      .send({ body: "Customer supplied supporting documents" })
      .expect(201);

    expect(response.body).toEqual(COMMENT_RESPONSE);
    expect(createComment).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      body: "Customer supplied supporting documents",
      employeeId: EMPLOYEE_ID,
    });
  });

  it("rejects invalid comment bodies before calling the service", async () => {
    const { app, createComment } = createAccountCommentTestFixture();

    const emptyBody = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/comments`)
      .send({ body: "" })
      .expect(400);
    const unexpectedProperty = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/comments`)
      .send({ body: "Review note", customerId: 1 })
      .expect(400);

    expect(emptyBody.body.code).toBe("VALIDATION_ERROR");
    expect(unexpectedProperty.body.code).toBe("VALIDATION_ERROR");
    expect(createComment).not.toHaveBeenCalled();
  });

  it("returns not found when the target account does not exist", async () => {
    const { app, createComment } = createAccountCommentTestFixture();
    createComment.mockRejectedValueOnce(
      new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found"),
    );

    const response = await request(app)
      .post(`/v1/accounts/${ACCOUNT_ID}/comments`)
      .send({ body: "Review note" })
      .expect(404);

    expect(response.body.code).toBe("ACCOUNT_NOT_FOUND");
  });
});
