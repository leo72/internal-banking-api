import { AppError } from "../../errors/app-error.js";
import { sha256 } from "../../lib/hash.js";
import { parseMoneyToMinorUnits } from "../../lib/money.js";
import { IDEMPOTENCY_KEY_PATTERN } from "../../lib/validation-patterns.js";
import type {
  CreateTransferCommand,
  ExecuteTransferCommand,
  TransferQueue,
  TransferRepository,
  TransferService,
} from "./types/transfer.types.js";

const IDEMPOTENCY_KEY_REGEXP = new RegExp(IDEMPOTENCY_KEY_PATTERN);

/** Normalizes and hashes a transfer command without employee-specific data. */
function normalizeTransferCommand(
  command: CreateTransferCommand,
): ExecuteTransferCommand {
  if (!IDEMPOTENCY_KEY_REGEXP.test(command.idempotencyKey)) {
    throw new AppError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must contain 8 to 128 URL-safe characters",
    );
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseMoneyToMinorUnits(command.amount);
  } catch {
    throw new AppError(
      400,
      "INVALID_TRANSFER_AMOUNT",
      "Transfer amount must use at most two decimal places",
    );
  }

  const sourceAccountId = command.sourceAccountId.toLowerCase();
  const destinationAccountId = command.destinationAccountId.toLowerCase();
  const canonicalRequest = JSON.stringify({
    sourceAccountId,
    destinationAccountId,
    amountMinor: amountMinor.toString(),
  });

  return {
    sourceAccountId,
    destinationAccountId,
    amountMinor,
    employeeId: command.employeeId,
    idempotencyKeyHash: sha256(command.idempotencyKey),
    requestHash: sha256(canonicalRequest),
  };
}

/** Creates queued transfer orchestration and account-history operations. */
export function createTransferService(
  repository: TransferRepository,
  queue: TransferQueue,
): TransferService {
  return {
    createTransfer(command) {
      const normalizedCommand = normalizeTransferCommand(command);
      return queue.enqueue(() =>
        repository.executeTransfer(normalizedCommand),
      );
    },

    getAccountHistory(accountId) {
      return repository.getAccountHistory(accountId.toLowerCase());
    },
  };
}
