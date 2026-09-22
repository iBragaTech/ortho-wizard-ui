import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ApiError } from "./errors.mjs";

export async function createApp({ authenticate, execute, portalOrigin, logger = true }) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 32768,
    requestTimeout: 15000,
    trustProxy: false,
  });
  await app.register(cors, {
    origin: portalOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["X-Request-Id"],
    credentials: false,
  });
  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Request-Id", request.id);
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error instanceof ApiError
        ? error.statusCode
        : [400, 413, 415, 429].includes(error.statusCode)
          ? error.statusCode
          : 500;
    const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
    app.log.warn({ requestId: request.id, status, code }, "request_rejected");
    reply.code(status).send({
      error: {
        code,
        message:
          error instanceof ApiError ? error.message : "Não foi possível processar a requisição.",
      },
      requestId: request.id,
    });
  });
  // Liveness only: deliberately does not reveal or test Oracle connectivity.
  app.get("/health/live", async () => ({ status: "ok" }));
  app.post(
    "/v1/operations/:operation",
    {
      onRequest: async (request) => {
        request.principal = await authenticate(request.headers.authorization);
      },
    },
    async (request, reply) => {
      const data = await execute({
        name: request.params.operation,
        body: request.body,
        principal: request.principal,
        requestId: request.id,
      });
      return reply.send({ data, requestId: request.id });
    },
  );
  return app;
}
