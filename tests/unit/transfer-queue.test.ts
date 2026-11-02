import { InProcessTransferQueue } from "../../src/modules/transfers/transfer.queue.js";

describe("InProcessTransferQueue", () => {
  it("executes submitted operations sequentially in FIFO order", async () => {
    const queue = new InProcessTransferQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
      return 1;
    });
    const second = queue.enqueue(async () => {
      events.push("second:start");
      events.push("second:end");
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst?.();

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("continues processing after an operation fails", async () => {
    const queue = new InProcessTransferQueue();
    const failed = queue.enqueue(async () => {
      throw new Error("expected failure");
    });
    const succeeding = queue.enqueue(async () => "completed");

    await expect(failed).rejects.toThrow("expected failure");
    await expect(succeeding).resolves.toBe("completed");
  });

  it("rejects additional work when the queue is at capacity", async () => {
    const queue = new InProcessTransferQueue(1);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = queue.enqueue(async () => {
      await gate;
      return "first";
    });

    expect(() => queue.enqueue(async () => "second")).toThrow(
      "Transfer processing is at capacity, retry shortly",
    );

    release?.();
    await expect(first).resolves.toBe("first");
    await expect(queue.enqueue(async () => "third")).resolves.toBe("third");
  });
});
