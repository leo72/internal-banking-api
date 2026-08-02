import { Router } from "express";

/** Public process-liveness routes used by operators and container health checks. */
export const healthRouter = Router();

healthRouter.get("/live", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
