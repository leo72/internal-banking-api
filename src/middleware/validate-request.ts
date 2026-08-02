import type { RequestHandler } from "express";
import type { TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import { AppError } from "../errors/app-error.js";

/** Compiles a TypeBox schema into middleware for one request location. */
export function validateRequest<T extends TSchema>(
  location: "body" | "params" | "query",
  schema: T,
): RequestHandler {
  const validator = TypeCompiler.Compile(schema);

  return (request, _response, next) => {
    const input: unknown = request[location];
    if (validator.Check(input)) {
      next();
      return;
    }

    const issues = [...validator.Errors(input)].map((error) => ({
      path: error.path || "/",
      message: error.message,
    }));
    next(
      new AppError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed",
        issues,
      ),
    );
  };
}
