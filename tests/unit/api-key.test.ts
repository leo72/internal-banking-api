import { hashApiKey } from "../../src/lib/api-key.js";

describe("hashApiKey", () => {
  const apiKey = "development-api-key-value-0001";
  const pepper = "test-api-key-pepper-with-32-characters";

  it("creates a deterministic SHA-256 digest without retaining the key", () => {
    const digest = hashApiKey(apiKey, pepper);

    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(apiKey);
    expect(hashApiKey(apiKey, pepper)).toBe(digest);
  });

  it("changes when either the key or pepper changes", () => {
    expect(hashApiKey("development-api-key-value-0002", pepper)).not.toBe(
      hashApiKey(apiKey, pepper),
    );
    expect(
      hashApiKey(apiKey, "different-api-key-pepper-32-characters"),
    ).not.toBe(hashApiKey(apiKey, pepper));
  });

  it("rejects weak key material", () => {
    expect(() => hashApiKey("short", pepper)).toThrow(
      "API keys must contain at least 24 characters",
    );
    expect(() => hashApiKey(apiKey, "short")).toThrow(
      "API key pepper must contain at least 32 characters",
    );
  });
});
