import { Type } from "@sinclair/typebox";

import { MONEY_AMOUNT_PATTERN } from "../../lib/money.js";
import {
  CURRENCY_CODE_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  UUID_PATTERN,
} from "../../lib/validation-patterns.js";

export const CreateTransferBodySchema = Type.Object(
  {
    sourceAccountId: Type.String({ pattern: UUID_PATTERN }),
    destinationAccountId: Type.String({ pattern: UUID_PATTERN }),
    amount: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
  },
  { additionalProperties: false },
);

export const TransferHistoryParamsSchema = Type.Object(
  {
    accountId: Type.String({ pattern: UUID_PATTERN }),
  },
  { additionalProperties: false },
);

export const IdempotencyKeySchema = Type.String({
  pattern: IDEMPOTENCY_KEY_PATTERN,
});

export const TransferResponseSchema = Type.Object(
  {
    id: Type.String({ pattern: UUID_PATTERN }),
    sourceAccountId: Type.String({ pattern: UUID_PATTERN }),
    destinationAccountId: Type.String({ pattern: UUID_PATTERN }),
    amount: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    currency: Type.String({ pattern: CURRENCY_CODE_PATTERN }),
    sourceBalanceAfter: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    destinationBalanceAfter: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    initiatedByEmployeeId: Type.String({ pattern: UUID_PATTERN }),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);

export const TransferHistoryItemSchema = Type.Object(
  {
    id: Type.String({ pattern: UUID_PATTERN }),
    direction: Type.Union([
      Type.Literal("INCOMING"),
      Type.Literal("OUTGOING"),
    ]),
    sourceAccountId: Type.String({ pattern: UUID_PATTERN }),
    destinationAccountId: Type.String({ pattern: UUID_PATTERN }),
    amount: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    currency: Type.String({ pattern: CURRENCY_CODE_PATTERN }),
    balanceAfter: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    initiatedByEmployeeId: Type.String({ pattern: UUID_PATTERN }),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);

export const TransferHistoryResponseSchema = Type.Object(
  {
    accountId: Type.String({ pattern: UUID_PATTERN }),
    transfers: Type.Array(TransferHistoryItemSchema),
  },
  { additionalProperties: false },
);
