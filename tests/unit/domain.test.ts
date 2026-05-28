import { describe, expect, it } from "vitest";
import type { DaemonEventType } from "../../src/domain/events.js";
import { createDaemonEvent } from "../../src/domain/events.js";
import { createRun } from "../../src/domain/runs.js";

describe("domain model", () => {
  it("creates ordered daemon events with stable envelope fields", () => {
    const event = createDaemonEvent({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started" as DaemonEventType,
      createdAt: "2026-05-28T00:00:00.000Z",
      sequence: 7,
      data: { status: "running" }
    });

    expect(event).toEqual({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started" as DaemonEventType,
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

  it("applies defaults when authMode and permissionMode are omitted", () => {
    const run = createRun({
      id: "run_2",
      createdAt: "2026-05-28T00:00:00.000Z",
      provider: "openai",
      prompt: "list files"
    });

    expect(run.authMode).toBe("auto");
    expect(run.permissionMode).toBe("normal");
  });

  it("throws when createDaemonEvent is called without id", () => {
    expect(() =>
      createDaemonEvent({
        id: "",
        runId: "run_1",
        provider: "codex",
        type: "run.started" as DaemonEventType,
        createdAt: "2026-05-28T00:00:00.000Z",
        sequence: 1,
        data: {}
      })
    ).toThrow("DaemonEvent requires id and runId");
  });
});
