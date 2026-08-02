import type { Static } from "@sinclair/typebox";

import type {
  CreateTransferBodySchema,
  TransferHistoryItemSchema,
  TransferHistoryParamsSchema,
  TransferHistoryResponseSchema,
  TransferResponseSchema,
} from "../transfer.schemas.js";

export type CreateTransferBody = Static<typeof CreateTransferBodySchema>;
export type TransferHistoryParams = Static<
  typeof TransferHistoryParamsSchema
>;
export type TransferResponse = Static<typeof TransferResponseSchema>;
export type TransferHistoryItem = Static<typeof TransferHistoryItemSchema>;
export type TransferHistoryResponse = Static<
  typeof TransferHistoryResponseSchema
>;

export type CreateTransferCommand = CreateTransferBody &
  Readonly<{
    employeeId: string;
    idempotencyKey: string;
  }>;

export type ExecuteTransferCommand = Readonly<{
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: bigint;
  employeeId: string;
  idempotencyKeyHash: string;
  requestHash: string;
}>;

export type TransferExecutionResult = Readonly<{
  statusCode: number;
  body: unknown;
  isReplay: boolean;
}>;

/** Database operations required by transfer orchestration. */
export type TransferRepository = Readonly<{
  executeTransfer(
    command: ExecuteTransferCommand,
  ): Promise<TransferExecutionResult>;
  getAccountHistory(accountId: string): Promise<TransferHistoryResponse>;
}>;

/** Transfer operations exposed to HTTP routes. */
export type TransferService = Readonly<{
  createTransfer(
    command: CreateTransferCommand,
  ): Promise<TransferExecutionResult>;
  getAccountHistory(accountId: string): Promise<TransferHistoryResponse>;
}>;

/** Single-concurrency queue used for transfer admission within one process. */
export type TransferQueue = Readonly<{
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
}>;
