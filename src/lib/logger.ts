import pino, { type Logger } from "pino";
import type { ReqId, StdSerializedResults } from "pino-http";

const REDACTED_LOG_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "res.headers.set-cookie",
  "response.headers.set-cookie",
  "authorization",
  "cookie",
  "apiKey",
  "apiKeyHash",
  "pepper",
  "password",
] as const;

/** Creates the structured stdout logger with sensitive fields redacted. */
export function createLogger(nodeEnv: string): Logger {
  return pino({
    base: null,
    level: nodeEnv === "test" ? "silent" : "info",
    redact: {
      paths: [...REDACTED_LOG_PATHS],
      censor: "[REDACTED]",
    },
  });
}

type SerializedRequestWithId = StdSerializedResults["req"] & {
  id?: ReqId;
};

export type SafeRequestLog = Readonly<{
  id?: string | number;
  method?: string;
  path?: string;
}>;

export type SafeResponseLog = Readonly<{
  statusCode: number;
}>;

/** Reduces an HTTP request log to an allowlist of non-sensitive metadata. */
export function serializeRequestForLog(
  request: SerializedRequestWithId,
): SafeRequestLog {
  const requestId =
    typeof request.id === "string" || typeof request.id === "number"
      ? request.id
      : undefined;
  const path = request.url?.split("?")[0];

  return {
    ...(requestId === undefined ? {} : { id: requestId }),
    ...(request.method === undefined ? {} : { method: request.method }),
    ...(path === undefined ? {} : { path }),
  };
}

/** Reduces an HTTP response log to its status code. */
export function serializeResponseForLog(
  response: StdSerializedResults["res"],
): SafeResponseLog {
  return { statusCode: response.statusCode };
}
