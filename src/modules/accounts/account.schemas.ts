import { Type } from "@sinclair/typebox";

import { MONEY_AMOUNT_PATTERN } from "../../lib/money.js";

const UUID_PATTERN =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";

export const CustomerAccountParamsSchema = Type.Object(
  {
    customerId: Type.String({ pattern: "^[1-9][0-9]{0,9}$" }),
  },
  { additionalProperties: false },
);

export const AccountIdParamsSchema = Type.Object(
  {
    accountId: Type.String({ pattern: UUID_PATTERN }),
  },
  { additionalProperties: false },
);

export const CreateAccountBodySchema = Type.Object(
  {
    currency: Type.String({ pattern: "^[A-Z]{3}$" }),
    initialDeposit: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
  },
  { additionalProperties: false },
);

export const AccountResponseSchema = Type.Object(
  {
    id: Type.String({ pattern: UUID_PATTERN }),
    customerId: Type.Integer(),
    currency: Type.String({ pattern: "^[A-Z]{3}$" }),
    initialDeposit: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    balance: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);

export const AccountBalanceResponseSchema = Type.Object(
  {
    accountId: Type.String({ pattern: UUID_PATTERN }),
    currency: Type.String({ pattern: "^[A-Z]{3}$" }),
    balance: Type.String({ pattern: MONEY_AMOUNT_PATTERN }),
  },
  { additionalProperties: false },
);
