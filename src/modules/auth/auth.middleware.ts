import type { RequestHandler, Response } from "express";

import { hashApiKey } from "../../lib/api-key.js";
import type { DatabaseClient } from "../../types/database.types.js";
import type {
  EmployeeApiKeyLookup,
  EmployeeAuthenticationOptions,
} from "./types/auth.types.js";

const BEARER_API_KEY_PATTERN = /^Bearer ([A-Za-z0-9._~-]{24,128})$/i;

/** Creates the database lookup used by employee API-key authentication. */
export function createEmployeeApiKeyLookup(
  database: DatabaseClient,
): EmployeeApiKeyLookup {
  return async (apiKeyHash) =>
    database.employee.findUnique({
      where: { apiKeyHash },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
}

/** Extracts a bounded API key from a strict Bearer authorization value. */
function parseBearerApiKey(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  return BEARER_API_KEY_PATTERN.exec(authorization)?.[1] ?? null;
}

/** Sends the same authentication failure for missing or invalid credentials. */
function sendUnauthorized(response: Response): void {
  response
    .status(401)
    .set("WWW-Authenticate", "Bearer")
    .json({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Valid employee credentials are required",
    });
}

/** Authenticates an active employee and attaches their identity to locals. */
export function createEmployeeAuthentication(
  options: EmployeeAuthenticationOptions,
): RequestHandler {
  return async (request, response, next) => {
    const apiKey = parseBearerApiKey(request.get("authorization"));
    if (!apiKey) {
      sendUnauthorized(response);
      return;
    }

    const apiKeyHash = hashApiKey(apiKey, options.apiKeyPepper);
    const employee = await options.findEmployeeByApiKeyHash(apiKeyHash);
    if (!employee?.isActive) {
      sendUnauthorized(response);
      return;
    }

    response.locals.employee = {
      id: employee.id,
      name: employee.name,
    };
    next();
  };
}
