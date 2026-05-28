import { describe, expect, it } from "vitest";
import { RunRegistry } from "../../src/application/runRegistry.js";

describe("RunRegistry", () => {
  it("stores runs and retrieves them by id", () => {
    const registry = new RunRegistry();
    registry.addRun({ id: "run_1", provider: "codex", prompt: "hi", permissionMode: "normal", authMode: "auto", status: "queued", createdAt: "now", updatedAt: "now" });

    expect(registry.getRun("run_1")?.status).toBe("queued");
    expect(registry.getRun("run_1")?.provider).toBe("codex");
  });

  it("stores and retrieves handles by run id", () => {
    const registry = new RunRegistry();
    registry.setHandle("run_1", { provider: "codex", native: { id: "thread_1" } });

    expect(registry.getHandle("run_1")?.provider).toBe("codex");
  });

  it("lists all stored runs", () => {
    const registry = new RunRegistry();
    registry.addRun({ id: "run_1", provider: "codex", prompt: "a", permissionMode: "normal", authMode: "auto", status: "queued", createdAt: "now", updatedAt: "now" });
    registry.addRun({ id: "run_2", provider: "claude", prompt: "b", permissionMode: "normal", authMode: "auto", status: "queued", createdAt: "now", updatedAt: "now" });

    expect(registry.listRuns()).toHaveLength(2);
  });

  it("updates a run", () => {
    const registry = new RunRegistry();
    registry.addRun({ id: "run_1", provider: "codex", prompt: "a", permissionMode: "normal", authMode: "auto", status: "queued", createdAt: "now", updatedAt: "now" });
    registry.updateRun("run_1", { status: "running" });

    expect(registry.getRun("run_1")?.status).toBe("running");
  });

  it("removes a handle", () => {
    const registry = new RunRegistry();
    registry.setHandle("run_1", { provider: "codex", native: { id: "thread_1" } });
    registry.removeHandle("run_1");

    expect(registry.getHandle("run_1")).toBeUndefined();
  });
});
