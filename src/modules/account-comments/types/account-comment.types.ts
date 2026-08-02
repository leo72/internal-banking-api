import type { Static } from "@sinclair/typebox";

import type {
  AccountCommentResponseSchema,
  CreateAccountCommentBodySchema,
} from "../account-comment.schemas.js";

export type CreateAccountCommentBody = Static<
  typeof CreateAccountCommentBodySchema
>;
export type AccountCommentResponse = Static<
  typeof AccountCommentResponseSchema
>;

export type CreateAccountCommentCommand = Readonly<{
  accountId: string;
  body: string;
  employeeId: string;
}>;

/** Account-level internal comment operations exposed to authenticated routes. */
export type AccountCommentService = Readonly<{
  createComment(
    command: CreateAccountCommentCommand,
  ): Promise<AccountCommentResponse>;
}>;
