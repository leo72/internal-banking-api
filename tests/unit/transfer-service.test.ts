import { jest } from "@jest/globals";

import { sha256 } from "../../src/lib/hash.js";
import { InProcessTransferQueue } from "../../src/modules/transfers/transfer.queue.js";
import { createTransferService } from "../../src/modules/transfers/transfer.service.js";
import type {
  ExecuteTransferCommand,
  TransferExecutionResult,
  TransferRepository,
} from "../../src/modules/transfers/types/transfer.types.js";

const SOURCE_ACCOUNT_ID = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const DESTINATION_ACCOUNT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMPLOYEE_ID = "00000000-0000-4000-8000-000000000001";

/** Creates a repository test double that records normalized commands. */
function createRepositoryFixture() {
  const result = {
    statusCode: 201,
    body: { id: "transfer-id" },
    isReplay: false,
  } satisfies TransferExecutionResult;
  const executeTransfer = jest.fn(
    async (command: ExecuteTransferCommand) => {
      void command;
      return result;
    },
  );
  const getAccountHistory = jest.fn(async (accountId: string) => ({
    accountId,
    transfers: [],
  }));
  const repository = {
    executeTransfer,
    getAccountHistory,
  } satisfies TransferRepository;

  return { executeTransfer, getAccountHistory, repository };
}

describe("transfer service", () => {
  it("canonicalizes equivalent amounts and account UUID casing", async () => {
    const { executeTransfer, repository } = createRepositoryFixture();
    const service = createTransferService(
      repository,
      new InProcessTransferQueue(),
    );

    await service.createTransfer({
      sourceAccountId: SOURCE_ACCOUNT_ID,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amount: "1",
      employeeId: EMPLOYEE_ID,
      idempotencyKey: "transfer-key-one",
    });
    await service.createTransfer({
      sourceAccountId: SOURCE_ACCOUNT_ID.toLowerCase(),
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amount: "1.00",
      employeeId: EMPLOYEE_ID,
      idempotencyKey: "transfer-key-two",
    });

    const firstCommand = executeTransfer.mock.calls[0]?.[0];
    const secondCommand = executeTransfer.mock.calls[1]?.[0];
    expect(firstCommand?.sourceAccountId).toBe(
      SOURCE_ACCOUNT_ID.toLowerCase(),
    );
    expect(firstCommand?.requestHash).toBe(secondCommand?.requestHash);
    expect(firstCommand?.idempotencyKeyHash).toBe(
      sha256("transfer-key-one"),
    );
  });

  it("delegates account history with a normalized UUID", async () => {
    const { getAccountHistory, repository } = createRepositoryFixture();
    const service = createTransferService(
      repository,
      new InProcessTransferQueue(),
    );

    await service.getAccountHistory(SOURCE_ACCOUNT_ID);

    expect(getAccountHistory).toHaveBeenCalledWith(
      SOURCE_ACCOUNT_ID.toLowerCase(),
    );
  });
});
