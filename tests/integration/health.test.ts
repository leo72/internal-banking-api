import { Writable } from "node:stream";

import { Router, type RequestHandler } from "express";
import pino from "pino";
import request from "supertest";

import { createApp } from "../../src/app.js";

const rejectUnexpectedAuthentication: RequestHandler = (
  _request,
  _response,
  next,
) => {
  next(new Error("Health routes must not invoke employee authentication"));
};

describe("health endpoint", () => {
  it("reports that the process is alive", async () => {
    const response = await request(
      createApp({
        apiRouter: Router(),
        authenticateEmployee: rejectUnexpectedAuthentication,
        nodeEnv: "test",
      }),
    )
      .get("/health/live")
      .expect(200);

    expect(response.body).toEqual({ status: "ok" });
  });

  it("logs only safe request and response metadata", async () => {
    const logChunks: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        logChunks.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ level: "info" }, destination);

    await request(
      createApp({
        apiRouter: Router(),
        authenticateEmployee: rejectUnexpectedAuthentication,
        logger,
        nodeEnv: "test",
      }),
    )
      .get("/health/live?token=query-secret")
      .set("Authorization", "Bearer authorization-secret")
      .set("Cookie", "session=cookie-secret")
      .set("User-Agent", "private-user-agent")
      .expect(200);

    const logOutput = logChunks.join("");

    expect(logOutput).toContain('"method":"GET"');
    expect(logOutput).toContain('"path":"/health/live"');
    expect(logOutput).toContain('"statusCode":200');
    expect(logOutput).not.toContain("query-secret");
    expect(logOutput).not.toContain("authorization-secret");
    expect(logOutput).not.toContain("cookie-secret");
    expect(logOutput).not.toContain("private-user-agent");
    expect(logOutput).not.toContain('"headers"');
  });
});
