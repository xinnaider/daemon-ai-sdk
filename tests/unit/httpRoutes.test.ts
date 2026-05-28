import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../../src/adapters/http/routes.js";
import type { AgentRun, AgentRunRequest } from "../../src/domain/runs.js";
import type { ProviderAuthStatus } from "../../src/domain/auth.js";
import type { SdkActionDescriptor, SdkActionResult } from "../../src/domain/providers.js";
import type { PermissionResolution } from "../../src/domain/permissions.js";

function makeMockDeps() {
  const mockProvider = {
    startRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    resolvePermission: vi.fn(),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
    getCapabilities: vi.fn(),
    getAuthStatus: vi.fn<() => Promise<ProviderAuthStatus>>().mockResolvedValue({
      mode: "auto",
      available: true,
      source: null,
      requiresApiKey: false,
    }),
    listActions: vi.fn<() => SdkActionDescriptor[]>().mockReturnValue([]),
  };

  const providers = {
    get: vi.fn().mockReturnValue(mockProvider),
    register: vi.fn(),
    list: vi.fn<() => string[]>().mockReturnValue(["opencode", "claude"]),
    authStatusFor: vi.fn<() => Promise<ProviderAuthStatus>>().mockResolvedValue({
      mode: "auto",
      available: true,
      source: null,
      requiresApiKey: false,
    }),
    actionsFor: vi.fn<() => SdkActionDescriptor[]>().mockReturnValue([]),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
  };

  const runs = {
    addRun: vi.fn(),
    getRun: vi.fn<() => AgentRun | undefined>(),
    listRuns: vi.fn<() => AgentRun[]>().mockReturnValue([]),
    updateRun: vi.fn(),
    setHandle: vi.fn(),
    getHandle: vi.fn(),
    removeHandle: vi.fn(),
  };

  const permissions = {
    createPending: vi.fn(),
    getPending: vi.fn(),
    resolve: vi.fn(),
    rejectAllForRun: vi.fn(),
  };

  const events = {
    publish: vi.fn(),
    replay: vi.fn(),
    subscribe: vi.fn(),
  };

  const logger = {
    log: vi.fn(),
    list: vi.fn(),
  };

  const execution = {
    startRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    resolvePermission: vi.fn(),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
  };

  return { mockProvider, providers, runs, permissions, events, logger, execution };
}

function buildApp(deps: ReturnType<typeof makeMockDeps>) {
  const app = Fastify({ logger: false });
  registerRoutes(app, deps);
  return app;
}

function makeRun(overrides?: Partial<AgentRun>): AgentRun {
  return {
    id: "run_1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    provider: "opencode",
    prompt: "test",
    status: "queued",
    authMode: "auto",
    permissionMode: "normal",
    ...overrides,
  };
}

describe("HTTP Routes", () => {
  describe("GET /health", () => {
    it("returns ok", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });
  });

  describe("GET /providers", () => {
    it("returns providers with auth metadata", async () => {
      const deps = makeMockDeps();
      deps.providers.authStatusFor.mockResolvedValue({
        mode: "auto",
        available: true,
        source: "env",
        requiresApiKey: true,
      });
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/providers" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("providers");
      expect(body.providers).toContainEqual(
        expect.objectContaining({ id: "opencode", auth: expect.objectContaining({ mode: "auto" }) })
      );
      expect(body.providers).toContainEqual(
        expect.objectContaining({ id: "claude", auth: expect.objectContaining({ mode: "auto" }) })
      );
    });
  });

  describe("GET /providers/:provider/actions", () => {
    it("returns actions for a provider", async () => {
      const deps = makeMockDeps();
      const actions: SdkActionDescriptor[] = [
        { id: "read", provider: "opencode", scope: "fs", description: "Read file", inputSchema: {}, outputSchema: {}, streaming: false, sideEffects: false },
      ];
      deps.providers.actionsFor.mockReturnValue(actions);
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/providers/opencode/actions" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ actions });
    });

    it("returns 404 for unknown provider", async () => {
      const deps = makeMockDeps();
      deps.providers.get.mockImplementation(() => { throw new Error("Not found"); });
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/providers/unknown/actions" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /providers/:provider/actions", () => {
    it("executes a provider action", async () => {
      const deps = makeMockDeps();
      const result: SdkActionResult = { actionId: "read", output: { content: "hello" }, durationMs: 10 };
      deps.execution.executeProviderAction.mockResolvedValue(result);
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/providers/opencode/actions",
        payload: { actionId: "read", input: { path: "/tmp" } },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(result);
      expect(deps.execution.executeProviderAction).toHaveBeenCalledWith("opencode", {
        actionId: "read",
        input: { path: "/tmp" },
      });
    });

    it("returns 400 for invalid body", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/providers/opencode/actions",
        payload: { badField: true },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /runs", () => {
    it("creates a run and defaults authMode to auto", async () => {
      const deps = makeMockDeps();
      const run = makeRun();
      deps.execution.startRun.mockResolvedValue(run);
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs",
        payload: { provider: "opencode", prompt: "test prompt" },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual(run);
      expect(deps.execution.startRun).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "opencode", prompt: "test prompt" })
      );
    });

    it("returns 400 for missing provider", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs",
        payload: { prompt: "test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for missing prompt", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs",
        payload: { provider: "opencode" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /runs", () => {
    it("lists runs", async () => {
      const deps = makeMockDeps();
      deps.runs.listRuns.mockReturnValue([makeRun({ id: "run_1" }), makeRun({ id: "run_2" })]);
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/runs" });

      expect(res.statusCode).toBe(200);
      expect(res.json().runs).toHaveLength(2);
    });
  });

  describe("GET /runs/:runId", () => {
    it("returns a run by id", async () => {
      const deps = makeMockDeps();
      deps.runs.getRun.mockReturnValue(makeRun());
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/runs/run_1" });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe("run_1");
    });

    it("returns 404 for unknown run", async () => {
      const deps = makeMockDeps();
      deps.runs.getRun.mockReturnValue(undefined);
      const app = buildApp(deps);

      const res = await app.inject({ method: "GET", url: "/runs/nonexistent" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /runs/:runId/cancel", () => {
    it("cancels a run", async () => {
      const deps = makeMockDeps();
      const cancelledRun = makeRun({ status: "cancelled" });
      deps.execution.cancelRun.mockResolvedValue(cancelledRun);
      const app = buildApp(deps);

      const res = await app.inject({ method: "POST", url: "/runs/run_1/cancel" });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("cancelled");
      expect(deps.execution.cancelRun).toHaveBeenCalledWith("run_1");
    });
  });

  describe("POST /runs/:runId/permissions/:permissionId", () => {
    it("resolves a permission", async () => {
      const deps = makeMockDeps();
      deps.execution.resolvePermission.mockResolvedValue(undefined);
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs/run_1/permissions/perm_1",
        payload: { decision: "allow", scope: "once" },
      });

      expect(res.statusCode).toBe(200);
      expect(deps.execution.resolvePermission).toHaveBeenCalledWith("run_1", "perm_1", {
        decision: "allow",
        scope: "once",
      });
    });

    it("returns 400 for invalid decision", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs/run_1/permissions/perm_1",
        payload: { decision: "maybe", scope: "once" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /runs/:runId/resume", () => {
    it("resumes a run", async () => {
      const deps = makeMockDeps();
      const run = makeRun({ status: "running" });
      deps.execution.resumeRun.mockResolvedValue(run);
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs/run_1/resume",
        payload: { sessionId: "sess_1" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("running");
      expect(deps.execution.resumeRun).toHaveBeenCalledWith("run_1", { sessionId: "sess_1" });
    });
  });

  describe("POST /runs/:runId/actions", () => {
    it("executes a run action", async () => {
      const deps = makeMockDeps();
      const result: SdkActionResult = { actionId: "read", output: { content: "hello" }, durationMs: 10 };
      deps.execution.executeRunAction.mockResolvedValue(result);
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs/run_1/actions",
        payload: { actionId: "read", input: { path: "/tmp" } },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(result);
      expect(deps.execution.executeRunAction).toHaveBeenCalledWith("run_1", {
        runId: "run_1",
        actionId: "read",
        input: { path: "/tmp" },
      });
    });

    it("returns 400 for invalid body", async () => {
      const deps = makeMockDeps();
      const app = buildApp(deps);

      const res = await app.inject({
        method: "POST",
        url: "/runs/run_1/actions",
        payload: { badField: true },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
