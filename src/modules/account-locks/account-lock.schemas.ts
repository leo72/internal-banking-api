import { Type } from "@sinclair/typebox";

import { UUID_PATTERN } from "../../lib/validation-patterns.js";

export const CreateAccountLockBodySchema = Type.Object(
  {
    reason: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const AccountLockResponseSchema = Type.Object(
  {
    id: Type.String({ pattern: UUID_PATTERN }),
    accountId: Type.String({ pattern: UUID_PATTERN }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
    lockedByEmployeeId: Type.String({ pattern: UUID_PATTERN }),
    lockedAt: Type.String(),
    unlockedByEmployeeId: Type.Union([
      Type.String({ pattern: UUID_PATTERN }),
      Type.Null(),
    ]),
    unlockedAt: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
