import { describe, expect, it, vi } from "vitest";
import { ExecutionService } from "../../src/application/executionService.js";
import type { AgentRunRequest, AgentRun } from "../../src/domain/runs.js";
import type { DaemonEvent, ProviderRawEvent } from "../../src/domain/events.js";
import type { PermissionResolution } from "../../src/domain/permissions.js";
import type { ProviderSdkActionRequest, RunSdkActionRequest, SdkActionResult } from "../../src/domain/providers.js";
import { createRun } from "../../src/domain/runs.js";

function makeMockDeps() {
  const mockProvider = {
    startRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    resolvePermission: vi.fn(),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
    getCapabilities: vi.fn(),
    getAuthStatus: vi.fn(),
    listActions: vi.fn(),
  };

  const providers = {
    get: vi.fn().mockReturnValue(mockProvider),
    register: vi.fn(),
    list: vi.fn(),
    authStatusFor: vi.fn(),
    actionsFor: vi.fn(),
    executeProviderAction: vi.fn(),
    executeRunAction: vi.fn(),
  };

  const runs = {
    addRun: vi.fn(),
    getRun: vi.fn(),
    listRuns: vi.fn(),
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

  const createId = vi.fn().mockReturnValue("run_test123");
  const now = vi.fn().mockReturnValue("2025-01-01T00:00:00.000Z");

  return { mockProvider, providers, runs, permissions, events, logger, createId, now };
}

function makeRunRequest(overrides?: Partial<AgentRunRequest>): AgentRunRequest {
  return {
    id: "req_1",
    createdAt: "2025-01-01T00:00:00.000Z",
    provider: "opencode",
    prompt: "test prompt",
    ...overrides,
  };
}

describe("ExecutionService", () => {
  describe("startRun", () => {
    it("logs the request input", async () => {
      const deps = makeMockDeps();
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      deps.mockProvider.startRun.mockResolvedValue(createRun(makeRunRequest({ id: "run_test123" })));
      const service = new ExecutionService(deps);

      await service.startRun(makeRunRequest());

      expect(deps.logger.log).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "run.start", message: "Starting run" })
      );
    });

    it("creates a run and emits run.created event", async () => {
      const deps = makeMockDeps();
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      deps.mockProvider.startRun.mockResolvedValue(createRun(makeRunRequest({ id: "run_test123" })));
      const service = new ExecutionService(deps);

      const run = await service.startRun(makeRunRequest());

      expect(deps.runs.addRun).toHaveBeenCalledWith(
        expect.objectContaining({ id: "req_1", status: "queued" })
      );
      expect(deps.events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ runId: "req_1", type: "run.created" })
      );
    });

    it("assigns run id and createdAt when HTTP request omits them", async () => {
      const deps = makeMockDeps();
      const service = new ExecutionService(deps);
      const request = makeRunRequest({ id: "", createdAt: "" });
      deps.mockProvider.startRun.mockImplementation(async (input: AgentRunRequest) => createRun(input));

      const run = await service.startRun(request);

      expect(run.id).toBe("run_test123");
      expect(run.createdAt).toBe("2025-01-01T00:00:00.000Z");
      expect(deps.mockProvider.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "run_test123",
          createdAt: "2025-01-01T00:00:00.000Z",
        }),
      );
    });

    it("calls provider startRun", async () => {
      const deps = makeMockDeps();
      const request = makeRunRequest();
      deps.mockProvider.startRun.mockResolvedValue(createRun(makeRunRequest({ id: "run_test123" })));
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      await service.startRun(request);

      expect(deps.providers.get).toHaveBeenCalledWith("opencode");
      expect(deps.mockProvider.startRun).toHaveBeenCalledWith(request);
    });

    it("stores provider handle", async () => {
      const deps = makeMockDeps();
      deps.mockProvider.startRun.mockResolvedValue(createRun(makeRunRequest({ id: "run_test123" })));
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      await service.startRun(makeRunRequest());

      expect(deps.runs.setHandle).toHaveBeenCalledWith(
        "req_1",
        expect.objectContaining({ provider: "opencode" })
      );
    });

    it("emits raw and normalized events", async () => {
      const deps = makeMockDeps();
      const rawEvent: ProviderRawEvent = { provider: "opencode", raw: { type: "text", text: "hello" } };
      deps.mockProvider.startRun.mockResolvedValue(createRun(makeRunRequest({ id: "run_test123" })));
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      await service.startRun(makeRunRequest());

      expect(deps.events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: "run.created" })
      );
    });

    it("updates run status on completion", async () => {
      const deps = makeMockDeps();
      const completedRun = createRun(makeRunRequest({ id: "run_test123" }));
      completedRun.status = "completed";
      deps.mockProvider.startRun.mockResolvedValue(completedRun);
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      const run = await service.startRun(makeRunRequest());

      expect(run.status).toBe("completed");
      expect(deps.runs.updateRun).toHaveBeenCalledWith(
        "req_1",
        expect.objectContaining({ status: "completed" })
      );
    });

    it("updates run status on failure", async () => {
      const deps = makeMockDeps();
      const failedRun = createRun(makeRunRequest({ id: "run_test123" }));
      failedRun.status = "failed";
      deps.mockProvider.startRun.mockResolvedValue(failedRun);
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      const run = await service.startRun(makeRunRequest());

      expect(run.status).toBe("failed");
      expect(deps.runs.updateRun).toHaveBeenCalledWith(
        "req_1",
        expect.objectContaining({ status: "failed" })
      );
    });

    it("updates run status on cancellation", async () => {
      const deps = makeMockDeps();
      const cancelledRun = createRun(makeRunRequest({ id: "run_test123" }));
      cancelledRun.status = "cancelled";
      deps.mockProvider.startRun.mockResolvedValue(cancelledRun);
      deps.runs.getRun.mockReturnValue(createRun(makeRunRequest()));
      const service = new ExecutionService(deps);

      const run = await service.startRun(makeRunRequest());

      expect(run.status).toBe("cancelled");
      expect(deps.runs.updateRun).toHaveBeenCalledWith(
        "req_1",
        expect.objectContaining({ status: "cancelled" })
      );
    });
  });

  describe("resumeRun", () => {
    it("calls provider resumeRun", async () => {
      const deps = makeMockDeps();
      const existingRun = createRun(makeRunRequest({ id: "run_1" }));
      existingRun.status = "running";
      deps.runs.getRun.mockReturnValue(existingRun);
      deps.mockProvider.resumeRun.mockResolvedValue(existingRun);
      const service = new ExecutionService(deps);

      await service.resumeRun("run_1", { sessionId: "sess_1" });

      expect(deps.providers.get).toHaveBeenCalledWith("opencode");
      expect(deps.mockProvider.resumeRun).toHaveBeenCalledWith("run_1");
    });

    it("returns the resumed run", async () => {
      const deps = makeMockDeps();
      const existingRun = createRun(makeRunRequest({ id: "run_1" }));
      existingRun.status = "running";
      deps.runs.getRun.mockReturnValue(existingRun);
      deps.mockProvider.resumeRun.mockResolvedValue(existingRun);
      const service = new ExecutionService(deps);

      const run = await service.resumeRun("run_1", { sessionId: "sess_1" });

      expect(run.status).toBe("running");
      expect(run.id).toBe("run_1");
    });
  });

  describe("cancelRun", () => {
    it("calls provider cancelRun", async () => {
      const deps = makeMockDeps();
      const existingRun = createRun(makeRunRequest({ id: "run_1" }));
      deps.runs.getRun.mockReturnValue(existingRun);
      deps.mockProvider.cancelRun.mockResolvedValue({ ...existingRun, status: "cancelled" });
      const service = new ExecutionService(deps);

      await service.cancelRun("run_1");

      expect(deps.providers.get).toHaveBeenCalledWith("opencode");
      expect(deps.mockProvider.cancelRun).toHaveBeenCalledWith("run_1");
    });

    it("returns cancelled run", async () => {
      const deps = makeMockDeps();
      const existingRun = createRun(makeRunRequest({ id: "run_1" }));
      const cancelledRun = { ...existingRun, status: "cancelled" as const };
      deps.runs.getRun.mockReturnValue(existingRun);
      deps.mockProvider.cancelRun.mockResolvedValue(cancelledRun);
      const service = new ExecutionService(deps);

      const run = await service.cancelRun("run_1");

      expect(run.status).toBe("cancelled");
    });
  });

  describe("resolvePermission", () => {
    it("updates PermissionService and provider adapter", async () => {
      const deps = makeMockDeps();
      const existingRun = createRun(makeRunRequest({ id: "run_1" }));
      deps.runs.getRun.mockReturnValue(existingRun);
      const resolution: PermissionResolution = { decision: "allow", scope: "once" };
      const service = new ExecutionService(deps);

      await service.resolvePermission("run_1", "perm_1", resolution);

      expect(deps.permissions.resolve).toHaveBeenCalledWith("run_1", "perm_1", resolution);
      expect(deps.mockProvider.resolvePermission).toHaveBeenCalledWith("run_1", "perm_1", resolution);
    });
  });

  describe("executeProviderAction", () => {
    it("delegates to provider registry", async () => {
      const deps = makeMockDeps();
      const request: ProviderSdkActionRequest = { actionId: "act_1", input: { x: 1 } };
      const result: SdkActionResult = { actionId: "act_1", output: { ok: true }, durationMs: 10 };
      deps.providers.executeProviderAction.mockResolvedValue(result);
      const service = new ExecutionService(deps);

      const res = await service.executeProviderAction("opencode", request);

      expect(deps.providers.executeProviderAction).toHaveBeenCalledWith("opencode", request);
      expect(res).toEqual(result);
    });
  });

  describe("executeRunAction", () => {
    it("delegates to provider registry", async () => {
      const deps = makeMockDeps();
      const request: RunSdkActionRequest = { runId: "run_1", actionId: "act_1", input: { x: 1 } };
      const result: SdkActionResult = { actionId: "act_1", output: { ok: true }, durationMs: 10 };
      deps.providers.executeRunAction.mockResolvedValue(result);
      const service = new ExecutionService(deps);

      const res = await service.executeRunAction("run_1", request);

      expect(deps.providers.executeRunAction).toHaveBeenCalledWith("run_1", request);
      expect(res).toEqual(result);
    });
  });
});
