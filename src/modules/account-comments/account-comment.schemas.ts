import { Type } from "@sinclair/typebox";

import { UUID_PATTERN } from "../../lib/validation-patterns.js";

export const CreateAccountCommentBodySchema = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 2000 }),
  },
  { additionalProperties: false },
);

export const AccountCommentResponseSchema = Type.Object(
  {
    id: Type.String({ pattern: UUID_PATTERN }),
    accountId: Type.String({ pattern: UUID_PATTERN }),
    body: Type.String({ minLength: 1, maxLength: 2000 }),
    createdByEmployeeId: Type.String({ pattern: UUID_PATTERN }),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);
