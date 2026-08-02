import type { AuthenticatedEmployee } from "./auth.types.js";

declare global {
  namespace Express {
    interface Locals {
      /** Active employee authenticated for the current business request. */
      employee?: AuthenticatedEmployee;
    }
  }
}

export {};
