import type { AuthenticatedEmployee } from "../../../types/auth.types.js";

/** Employee fields required to decide whether an API key is authorized. */
export type EmployeeCredentialRecord = AuthenticatedEmployee &
  Readonly<{
    isActive: boolean;
  }>;

/** Resolves an employee using a deterministic API-key digest. */
export type EmployeeApiKeyLookup = (
  apiKeyHash: string,
) => Promise<EmployeeCredentialRecord | null>;

/** Dependencies required to construct employee authentication middleware. */
export type EmployeeAuthenticationOptions = Readonly<{
  apiKeyPepper: string;
  findEmployeeByApiKeyHash: EmployeeApiKeyLookup;
}>;
