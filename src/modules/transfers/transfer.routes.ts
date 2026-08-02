import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Router } from "express";

import { AppError } from "../../errors/app-error.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { requireAuthenticatedEmployee } from "../auth/auth.context.js";
import {
  CreateTransferBodySchema,
  IdempotencyKeySchema,
  TransferHistoryParamsSchema,
} from "./transfer.schemas.js";
import type {
  CreateTransferBody,
  TransferHistoryParams,
  TransferHistoryResponse,
  TransferService,
} from "./types/transfer.types.js";

const idempotencyKeyValidator = TypeCompiler.Compile(IdempotencyKeySchema);

/** Reads and validates the transfer idempotency key header. */
function getIdempotencyKey(idempotencyKey: string | undefined): string {
  if (!idempotencyKey) {
    throw new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required",
    );
  }
  if (!idempotencyKeyValidator.Check(idempotencyKey)) {
    throw new AppError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must contain 8 to 128 URL-safe characters",
    );
  }
  return idempotencyKey;
}

/** Exposes transfer creation and account transfer-history endpoints. */
export function createTransferRouter(service: TransferService): Router {
  const router = Router();

  router.post<Record<string, never>, unknown, CreateTransferBody>(
    "/transfers",
    validateRequest("body", CreateTransferBodySchema),
    async (request, response) => {
      const employee = requireAuthenticatedEmployee(
        response.locals.employee,
      );
      const result = await service.createTransfer({
        ...request.body,
        employeeId: employee.id,
        idempotencyKey: getIdempotencyKey(
          request.get("Idempotency-Key"),
        ),
      });
      if (result.isReplay) {
        response.set("Idempotency-Replayed", "true");
      }
      response.status(result.statusCode).json(result.body);
    },
  );

  router.get<TransferHistoryParams, TransferHistoryResponse>(
    "/accounts/:accountId/transfers",
    validateRequest("params", TransferHistoryParamsSchema),
    async (request, response) => {
      const history = await service.getAccountHistory(
        request.params.accountId,
      );
      response.status(200).json(history);
    },
  );

  return router;
}
