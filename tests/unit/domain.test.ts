import { describe, expect, it } from "vitest";
import { createDaemonEvent } from "../../src/domain/events.js";
import { createRun } from "../../src/domain/runs.js";

describe("domain model", () => {
  it("creates ordered daemon events with stable envelope fields", () => {
    const event = createDaemonEvent({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started",
      createdAt: "2026-05-28T00:00:00.000Z",
      sequence: 7,
      data: { status: "running" }
    });

    expect(event).toEqual({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started",
      createdAt: "2026-05-28T00:00:00.000Z",
      sequence: 7,
      data: { status: "running" }
    });
  });

  it("creates a queued run from a normalized request", () => {
    const run = createRun({
      id: "run_1",
      createdAt: "2026-05-28T00:00:00.000Z",
      provider: "claude",
      prompt: "inspect repo",
      authMode: "auto",
      permissionMode: "normal"
    });

    expect(run.status).toBe("queued");
    expect(run.provider).toBe("claude");
    expect(run.authMode).toBe("auto");
    expect(run.permissionMode).toBe("normal");
  });
});
