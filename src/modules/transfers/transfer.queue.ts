import type { TransferQueue } from "./types/transfer.types.js";

/** In-memory FIFO that executes one transfer operation at a time. */
export class InProcessTransferQueue implements TransferQueue {
  private tail: Promise<void> = Promise.resolve();

  /** Adds an operation behind all previously submitted transfer work. */
  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
