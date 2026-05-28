import Fastify from "fastify";
import { registerRoutes } from "./routes.js";
import type { ServerDeps } from "./routes.js";

export function createServer(deps: ServerDeps) {
  const app = Fastify({ logger: false });
  registerRoutes(app, deps);
  return app;
}
