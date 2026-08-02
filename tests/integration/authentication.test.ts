import express, { type RequestHandler } from "express";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { hashApiKey } from "../../src/lib/api-key.js";
import { createEmployeeAuthentication } from "../../src/modules/auth/auth.middleware.js";
import type { EmployeeCredentialRecord } from "../../src/modules/auth/types/auth.types.js";

const API_KEY_PEPPER = "test-api-key-pepper-with-32-characters";
const EMPLOYEE_ONE_KEY = "employee-one-api-key-000000001";
const EMPLOYEE_TWO_KEY = "employee-two-api-key-000000002";
const INACTIVE_EMPLOYEE_KEY = "inactive-employee-key-000000003";
const UNKNOWN_EMPLOYEE_KEY = "unknown-employee-api-key-000000004";

const EMPLOYEE_ONE = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Alex Morgan",
  isActive: true,
} satisfies EmployeeCredentialRecord;

const EMPLOYEE_TWO = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Sam Rivera",
  isActive: true,
} satisfies EmployeeCredentialRecord;

const INACTIVE_EMPLOYEE = {
  id: "00000000-0000-4000-8000-000000000003",
  name: "Inactive Employee",
  isActive: false,
} satisfies EmployeeCredentialRecord;

const UNAUTHORIZED_RESPONSE = {
  status: 401,
  code: "UNAUTHORIZED",
  message: "Valid employee credentials are required",
};

/** Creates deterministic employee records and an in-memory credential lookup. */
function createAuthenticationFixture() {
  const employeesByHash = new Map<string, EmployeeCredentialRecord>([
    [hashApiKey(EMPLOYEE_ONE_KEY, API_KEY_PEPPER), EMPLOYEE_ONE],
    [hashApiKey(EMPLOYEE_TWO_KEY, API_KEY_PEPPER), EMPLOYEE_TWO],
    [
      hashApiKey(INACTIVE_EMPLOYEE_KEY, API_KEY_PEPPER),
      INACTIVE_EMPLOYEE,
    ],
  ]);
  const lookup = jest.fn(
    async (apiKeyHash: string): Promise<EmployeeCredentialRecord | null> =>
      employeesByHash.get(apiKeyHash) ?? null,
  );

  return {
    authenticateEmployee: createEmployeeAuthentication({
      apiKeyPepper: API_KEY_PEPPER,
      findEmployeeByApiKeyHash: lookup,
    }),
    lookup,
  };
}

/** Builds a minimal route that exposes the authenticated employee for assertions. */
function createProtectedTestApp(authenticateEmployee: RequestHandler) {
  const app = express();
  app.get("/protected", authenticateEmployee, (_request, response) => {
    response.status(200).json({ employee: response.locals.employee });
  });
  return app;
}

describe("employee authentication", () => {
  it("returns the same generic error for missing and malformed credentials", async () => {
    const { authenticateEmployee } = createAuthenticationFixture();
    const app = createProtectedTestApp(authenticateEmployee);

    const missingResponse = await request(app).get("/protected").expect(401);
    const malformedResponse = await request(app)
      .get("/protected")
      .set("Authorization", "Basic not-a-bearer-key")
      .expect(401);

    expect(missingResponse.body).toEqual(UNAUTHORIZED_RESPONSE);
    expect(malformedResponse.body).toEqual(UNAUTHORIZED_RESPONSE);
    expect(missingResponse.headers["www-authenticate"]).toBe("Bearer");
  });

  it("does not authenticate unknown or inactive employee keys", async () => {
    const { authenticateEmployee } = createAuthenticationFixture();
    const app = createProtectedTestApp(authenticateEmployee);

    const unknownResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${UNKNOWN_EMPLOYEE_KEY}`)
      .expect(401);
    const inactiveResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${INACTIVE_EMPLOYEE_KEY}`)
      .expect(401);

    expect(unknownResponse.body).toEqual(UNAUTHORIZED_RESPONSE);
    expect(inactiveResponse.body).toEqual(UNAUTHORIZED_RESPONSE);
  });

  it("attaches the identity associated with each employee credential", async () => {
    const { authenticateEmployee, lookup } = createAuthenticationFixture();
    const app = createProtectedTestApp(authenticateEmployee);

    const firstResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(200);
    const secondResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${EMPLOYEE_TWO_KEY}`)
      .expect(200);

    expect(firstResponse.body).toEqual({
      employee: { id: EMPLOYEE_ONE.id, name: EMPLOYEE_ONE.name },
    });
    expect(secondResponse.body).toEqual({
      employee: { id: EMPLOYEE_TWO.id, name: EMPLOYEE_TWO.name },
    });
    expect(lookup).toHaveBeenCalledWith(
      hashApiKey(EMPLOYEE_ONE_KEY, API_KEY_PEPPER),
    );
    expect(lookup).not.toHaveBeenCalledWith(EMPLOYEE_ONE_KEY);
  });

  it("keeps health public and protects every version-one route", async () => {
    const { authenticateEmployee } = createAuthenticationFixture();
    const app = createApp({ authenticateEmployee, nodeEnv: "test" });

    await request(app).get("/health/live").expect(200);
    await request(app).get("/v1/accounts").expect(401);
    await request(app)
      .get("/v1/accounts")
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(404);
  });

  it("does not expose authentication infrastructure failures", async () => {
    const authenticateEmployee = createEmployeeAuthentication({
      apiKeyPepper: API_KEY_PEPPER,
      findEmployeeByApiKeyHash: async () => {
        throw new Error("sensitive database details");
      },
    });
    const app = createApp({ authenticateEmployee, nodeEnv: "test" });

    const response = await request(app)
      .get("/v1/accounts")
      .set("Authorization", `Bearer ${EMPLOYEE_ONE_KEY}`)
      .expect(500);

    expect(response.body).toEqual({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "sensitive database details",
    );
  });
});
