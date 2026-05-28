import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createServer } from "../../src/adapters/http/server.js";
import type { ProviderAuthStatus } from "../../src/domain/auth.js";
import type { SdkActionDescriptor, SdkActionResult } from "../../src/domain/providers.js";
import type { AgentRun } from "../../src/domain/runs.js";

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
      mode: "auto", available: true, source: null, requiresApiKey: false,
    }),
    listActions: vi.fn<() => SdkActionDescriptor[]>().mockReturnValue([]),
  };

  const providers = {
    get: vi.fn().mockReturnValue(mockProvider),
    register: vi.fn(),
    list: vi.fn<() => string[]>().mockReturnValue(["opencode"]),
    authStatusFor: vi.fn<() => Promise<ProviderAuthStatus>>().mockResolvedValue({
      mode: "auto", available: true, source: null, requiresApiKey: false,
    }),
    actionsFor: vi.fn<() => SdkActionDescriptor[]>().mockReturnValue([]),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
  };

  const runs = {
    addRun: vi.fn(),
    getRun: vi.fn(),
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

describe("Server Lifecycle", () => {
  it("creates a server with health endpoint", async () => {
    const deps = makeMockDeps();
    const app = createServer(deps);

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("responds 404 for unknown routes", async () => {
    const deps = makeMockDeps();
    const app = createServer(deps);

    const res = await app.inject({ method: "GET", url: "/nonexistent" });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it("handles full create-run lifecycle via HTTP", async () => {
    const deps = makeMockDeps();
    const run: AgentRun = {
      id: "run_1", createdAt: "now", updatedAt: "now",
      provider: "opencode", prompt: "hello", status: "queued",
      authMode: "auto", permissionMode: "normal",
    };
    deps.execution.startRun.mockResolvedValue(run);
    deps.runs.getRun.mockReturnValue(run);
    const app = createServer(deps);

    const createRes = await app.inject({
      method: "POST", url: "/runs",
      payload: { provider: "opencode", prompt: "hello" },
    });
    expect(createRes.statusCode).toBe(201);

    const getRes = await app.inject({ method: "GET", url: "/runs/run_1" });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().status).toBe("queued");

    await app.close();
  });
});
