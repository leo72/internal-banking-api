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
});
