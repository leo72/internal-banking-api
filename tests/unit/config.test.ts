import {
  ConfigError,
  parseRuntimeConfig,
} from "../../src/config/env.js";

const VALID_ENVIRONMENT = {
  NODE_ENV: "test",
  PORT: "3100",
  DATABASE_URL: "postgresql://banking:banking@localhost:5432/banking_test",
  API_KEY_PEPPER: "test-api-key-pepper-with-32-characters",
} satisfies NodeJS.ProcessEnv;

describe("parseRuntimeConfig", () => {
  it("returns a normalized, typed configuration", () => {
    expect(parseRuntimeConfig(VALID_ENVIRONMENT)).toEqual({
      nodeEnv: "test",
      port: 3100,
      databaseUrl:
        "postgresql://banking:banking@localhost:5432/banking_test",
      apiKeyPepper: "test-api-key-pepper-with-32-characters",
    });
  });

  it("rejects invalid values without including their contents", () => {
    const invalidEnvironment = {
      ...VALID_ENVIRONMENT,
      PORT: "not-a-port",
      API_KEY_PEPPER: "secret",
    };

    expect(() => parseRuntimeConfig(invalidEnvironment)).toThrow(ConfigError);

    try {
      parseRuntimeConfig(invalidEnvironment);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ConfigError);
      if (!(error instanceof ConfigError)) {
        throw error;
      }
      expect(error.message).not.toContain("secret");
    }
  });
});
