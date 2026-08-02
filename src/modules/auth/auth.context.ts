import { AppError } from "../../errors/app-error.js";
import type { AuthenticatedEmployee } from "../../types/auth.types.js";

/** Returns the authenticated employee required by protected route handlers. */
export function requireAuthenticatedEmployee(
  employee: AuthenticatedEmployee | undefined,
): AuthenticatedEmployee {
  if (!employee) {
    throw new AppError(
      500,
      "AUTHENTICATION_CONTEXT_MISSING",
      "Authenticated employee context is unavailable",
    );
  }
  return employee;
}
