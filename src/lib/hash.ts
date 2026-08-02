import { createHash } from "node:crypto";

/** Produces a lowercase hexadecimal SHA-256 digest. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
