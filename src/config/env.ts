import { Type, type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const RuntimeConfigSchema = Type.Object(
  {
    nodeEnv: Type.Union([
      Type.Literal("development"),
      Type.Literal("test"),
      Type.Literal("production"),
    ]),
    port: Type.Integer({ minimum: 1, maximum: 65_535 }),
    databaseUrl: Type.String({ minLength: 1 }),
    apiKeyPepper: Type.String({ minLength: 32 }),
  },
  { additionalProperties: false },
);

const RuntimeConfigValidator = TypeCompiler.Compile(RuntimeConfigSchema);

export type RuntimeConfig = Readonly<Static<typeof RuntimeConfigSchema>>;

/** Reports which runtime configuration fields failed validation. */
export class ConfigError extends Error {
  public constructor(public readonly invalidPaths: readonly string[]) {
    super(`Invalid environment configuration: ${invalidPaths.join(", ")}`);
    this.name = "ConfigError";
  }
}

/** Parses and validates environment variables required by the API process. */
export function parseRuntimeConfig(
  environment: NodeJS.ProcessEnv,
): RuntimeConfig {
  const candidate = {
    nodeEnv: environment["NODE_ENV"] ?? "development",
    port: Number(environment["PORT"] ?? "3000"),
    databaseUrl: environment["DATABASE_URL"],
    apiKeyPepper: environment["API_KEY_PEPPER"],
  };

  if (!RuntimeConfigValidator.Check(candidate)) {
    const invalidPaths = [
      ...new Set(
        [...RuntimeConfigValidator.Errors(candidate)].map(
          (validationError) => validationError.path || "/",
        ),
      ),
    ];

    throw new ConfigError(invalidPaths);
  }

  return candidate;
}
