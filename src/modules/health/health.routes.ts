import { Router } from "express";

/** Public liveness and readiness routes used by operators and health checks. */
export function createHealthRouter(
  checkReadiness?: () => Promise<void>,
): Router {
  const router = Router();

  router.get("/live", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.get("/ready", async (_request, response) => {
    if (checkReadiness) {
      await checkReadiness();
    }

    response.status(200).json({ status: "ok" });
  });

  return router;
}
