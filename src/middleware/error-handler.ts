import type { ErrorRequestHandler } from "express";

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
