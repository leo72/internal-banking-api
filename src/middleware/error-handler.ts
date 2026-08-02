import type { ErrorRequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

/** Logs a safe error classification and returns a generic JSON response. */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      status: error.statusCode,
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  request.log.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Unhandled request error",
  );
  response.status(500).json({
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
};
