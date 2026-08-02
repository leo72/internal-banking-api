import { createHmac } from "node:crypto";

const MINIMUM_API_KEY_LENGTH = 24;
const MINIMUM_PEPPER_LENGTH = 32;

/** Produces the deterministic HMAC digest used to look up an employee API key. */
export function hashApiKey(apiKey: string, pepper: string): string {
  if (apiKey.length < MINIMUM_API_KEY_LENGTH) {
    throw new Error(
      `API keys must contain at least ${MINIMUM_API_KEY_LENGTH} characters`,
    );
  }

  if (pepper.length < MINIMUM_PEPPER_LENGTH) {
    throw new Error(
      `API key pepper must contain at least ${MINIMUM_PEPPER_LENGTH} characters`,
    );
  }

  return createHmac("sha256", pepper).update(apiKey, "utf8").digest("hex");
}
