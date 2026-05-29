import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { ExecutionService, ProviderResumeInput } from "../../application/executionService.js";
import type { AgentRunRequest } from "../../domain/runs.js";
import type { ProviderRegistry } from "../providers/common/providerRegistry.js";
import type { RunRegistry } from "../../application/runRegistry.js";
import type { EventBus } from "../../application/eventBus.js";
import type { EventLogger } from "../../ports/eventLogger.js";
import { writeSseHeaders, sendSseEvent, sendSseHeartbeat } from "./sse.js";

export interface ServerDeps {
  providers: ProviderRegistry;
  runs: RunRegistry;
  events: EventBus;
  logger: EventLogger;
  execution: ExecutionService;
}

const createRunSchema = z.object({
  provider: z.string().min(1),
  prompt: z.string().min(1),
  authMode: z.enum(["auto", "cli", "sdk"]).optional(),
  permissionMode: z.enum(["normal", "yolo"]).optional(),
});

const providerActionSchema = z.object({
  actionId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});

const runActionSchema = z.object({
  actionId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});

const permissionSchema = z.object({
  decision: z.enum(["allow", "deny"]),
  scope: z.enum(["once", "always", "until_reply"]),
});

const resumeRunSchema = z.object({
  sessionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function registerRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/providers", async () => {
    const ids = deps.providers.list();
    const providers = await Promise.all(
      ids.map(async (id) => ({
        id,
        auth: await deps.providers.authStatusFor(id),
      }))
    );
    return { providers };
  });

  app.get<{ Params: { provider: string } }>("/providers/:provider/actions", async (req, reply) => {
    try {
      deps.providers.get(req.params.provider);
    } catch {
      return reply.status(404).send({ error: `Unknown provider: ${req.params.provider}` });
    }
    const actions = deps.providers.actionsFor(req.params.provider);
    return { actions };
  });

  app.post<{ Params: { provider: string } }>("/providers/:provider/actions", async (req, reply) => {
    const parsed = providerActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }
    try {
      deps.providers.get(req.params.provider);
    } catch {
      return reply.status(404).send({ error: `Unknown provider: ${req.params.provider}` });
    }
    const result = await deps.execution.executeProviderAction(req.params.provider, parsed.data);
    return result;
  });

  app.post("/runs", async (req, reply) => {
    const parsed = createRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }
    const runRequest: AgentRunRequest = {
      id: "",
      createdAt: "",
      provider: parsed.data.provider,
      prompt: parsed.data.prompt,
    };
    if (parsed.data.authMode !== undefined) runRequest.authMode = parsed.data.authMode;
    if (parsed.data.permissionMode !== undefined) runRequest.permissionMode = parsed.data.permissionMode;
    const run = await deps.execution.startRun(runRequest);
    return reply.status(201).send(run);
  });

  app.get("/runs", async () => {
    const runs = deps.runs.listRuns();
    return { runs };
  });

  app.get<{ Params: { runId: string } }>("/runs/:runId", async (req, reply) => {
    const run = deps.runs.getRun(req.params.runId);
    if (!run) {
      return reply.status(404).send({ error: `Run not found: ${req.params.runId}` });
    }
    return run;
  });

  app.post<{ Params: { runId: string } }>("/runs/:runId/cancel", async (req, reply) => {
    try {
      const run = await deps.execution.cancelRun(req.params.runId);
      return run;
    } catch {
      return reply.status(404).send({ error: `Run not found: ${req.params.runId}` });
    }
  });

  app.post<{ Params: { runId: string; permissionId: string } }>(
    "/runs/:runId/permissions/:permissionId",
    async (req, reply) => {
      const parsed = permissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
      }
      await deps.execution.resolvePermission(req.params.runId, req.params.permissionId, parsed.data);
      return { ok: true };
    }
  );

  app.post<{ Params: { runId: string } }>("/runs/:runId/resume", async (req, reply) => {
    const parsed = resumeRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }
    try {
      const resumeInput: ProviderResumeInput = {};
      if (parsed.data.sessionId !== undefined) resumeInput.sessionId = parsed.data.sessionId;
      if (parsed.data.metadata !== undefined) resumeInput.metadata = parsed.data.metadata;
      const run = await deps.execution.resumeRun(req.params.runId, resumeInput);
      return run;
    } catch {
      return reply.status(404).send({ error: `Run not found: ${req.params.runId}` });
    }
  });

  app.post<{ Params: { runId: string } }>("/runs/:runId/actions", async (req, reply) => {
    const parsed = runActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }
    const result = await deps.execution.executeRunAction(req.params.runId, {
      runId: req.params.runId,
      ...parsed.data,
    });
    return result;
  });

  app.get<{ Params: { runId: string } }>("/runs/:runId/events", async (req, reply) => {
    const raw = reply.raw;
    writeSseHeaders(raw);

    const runId = req.params.runId;
    const prior = deps.events.replay(runId);
    for (const event of prior) {
      sendSseEvent(raw, event);
    }

    const unsub = deps.events.subscribe(runId, (event) => {
      sendSseEvent(raw, event);
    });

    const heartbeat = setInterval(() => {
      sendSseHeartbeat(raw);
    }, 15_000);

    await new Promise<void>((resolve) => {
      raw.on("close", () => {
        unsub();
        clearInterval(heartbeat);
        resolve();
      });
    });
  });

  app.get("/events", async (req, reply) => {
    const raw = reply.raw;
    writeSseHeaders(raw);

    const prior = deps.events.replay("all");
    for (const event of prior) {
      sendSseEvent(raw, event);
    }

    const unsub = deps.events.subscribe("all", (event) => {
      sendSseEvent(raw, event);
    });

    const heartbeat = setInterval(() => {
      sendSseHeartbeat(raw);
    }, 15_000);

    await new Promise<void>((resolve) => {
      raw.on("close", () => {
        unsub();
        clearInterval(heartbeat);
        resolve();
      });
    });
  });
}
