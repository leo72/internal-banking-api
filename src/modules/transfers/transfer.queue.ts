import { AppError } from "../../errors/app-error.js";
import type { TransferQueue } from "./types/transfer.types.js";

export const DEFAULT_TRANSFER_QUEUE_CAPACITY = 100;

/** In-memory FIFO that executes one transfer operation at a time. */
export class InProcessTransferQueue implements TransferQueue {
  private pendingCount = 0;
  private tail: Promise<void> = Promise.resolve();

  public constructor(
    private readonly maxPending: number = DEFAULT_TRANSFER_QUEUE_CAPACITY,
  ) {
    if (!Number.isInteger(maxPending) || maxPending < 1) {
      throw new RangeError("Transfer queue capacity must be a positive integer");
    }
  }

  /** Adds an operation behind all previously submitted transfer work. */
  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pendingCount >= this.maxPending) {
      throw new AppError(
        503,
        "TRANSFER_QUEUE_SATURATED",
        "Transfer processing is at capacity, retry shortly",
      );
    }

    this.pendingCount += 1;
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    void result.then(
      () => {
        this.pendingCount -= 1;
      },
      () => {
        this.pendingCount -= 1;
      },
    );
    return result;
  }
}
