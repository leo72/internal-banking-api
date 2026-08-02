import { AppError } from "../../errors/app-error.js";
import { UUID_PATTERN } from "../../lib/validation-patterns.js";
import type { DatabaseClient } from "../../types/database.types.js";
import type {
  AccountCommentService,
  CreateAccountCommentCommand,
} from "./types/account-comment.types.js";

const UUID_REGEXP = new RegExp(UUID_PATTERN);

/** Validates and normalizes an account comment command. */
function normalizeCommentCommand(
  command: CreateAccountCommentCommand,
): CreateAccountCommentCommand {
  const body = command.body.trim();
  if (!UUID_REGEXP.test(command.accountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Account ID is invalid");
  }
  if (body.length === 0 || body.length > 2000) {
    throw new AppError(
      400,
      "INVALID_COMMENT_BODY",
      "Comment body must contain between 1 and 2000 characters",
    );
  }
  return { ...command, accountId: command.accountId.toLowerCase(), body };
}

/** Creates employee-attributed comments on individual bank accounts. */
export function createAccountCommentService(
  database: DatabaseClient,
): AccountCommentService {
  return {
    async createComment(input) {
      const command = normalizeCommentCommand(input);
      const account = await database.account.findUnique({
        where: { id: command.accountId },
        select: { id: true },
      });
      if (!account) {
        throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found");
      }

      const comment = await database.accountComment.create({
        data: {
          accountId: account.id,
          body: command.body,
          createdByEmployeeId: command.employeeId,
        },
      });

      return {
        id: comment.id,
        accountId: comment.accountId,
        body: comment.body,
        createdByEmployeeId: comment.createdByEmployeeId,
        createdAt: comment.createdAt.toISOString(),
      };
    },
  };
}
