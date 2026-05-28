import { describe, expect, it } from "vitest";
import type { ProviderRawEvent } from "../../src/domain/events.js";
import type { NormalizeInput } from "../../src/application/eventNormalizer.js";
import { normalizeCodexEvent } from "../../src/adapters/providers/codex/codexNormalizer.js";
import {
  sessionLifecycleEvents,
  turnEvents,
  itemEvents,
  errorEvent,
} from "../fixtures/codexEvents.js";

function makeInput(raw: unknown, runId = "run_1", sequence = 1): NormalizeInput {
  return {
    provider: "codex",
    raw,
    runId,
    sequence,
  };
}

describe("codexNormalizer", () => {
  it("normalizes thread.started to session.discovered", () => {
    const events = normalizeCodexEvent(makeInput(sessionLifecycleEvents[0]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("session.discovered");
    expect(events[0]!.provider).toBe("codex");
    expect(events[0]!.runId).toBe("run_1");
    expect(events[0]!.data.raw).toEqual(sessionLifecycleEvents[0]);
  });

  it("normalizes turn.started to run.started", () => {
    const events = normalizeCodexEvent(makeInput(turnEvents[0]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.started");
  });

  it("normalizes turn.completed to usage.updated and run.completed", () => {
    const events = normalizeCodexEvent(makeInput(turnEvents[1]));
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe("usage.updated");
    expect(events[1]!.type).toBe("run.completed");
  });

  it("normalizes turn.failed to run.failed", () => {
    const events = normalizeCodexEvent(makeInput(turnEvents[2]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.failed");
  });

  it("normalizes agent_message item to message.started, message.delta, message.completed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.agent_message));
    const types = events.map((e) => e.type);
    expect(types).toContain("message.started");
    expect(types).toContain("message.delta");
    expect(types).toContain("message.completed");
  });

  it("normalizes reasoning item to reasoning.started, reasoning.delta, reasoning.completed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.reasoning));
    const types = events.map((e) => e.type);
    expect(types).toContain("reasoning.started");
    expect(types).toContain("reasoning.delta");
    expect(types).toContain("reasoning.completed");
  });

  it("normalizes command_execution to tool.started, tool.delta, tool.completed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.command_execution));
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.started");
    expect(types).toContain("tool.delta");
    expect(types).toContain("tool.completed");
  });

  it("normalizes file_change to file.changed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.file_change));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("file.changed");
  });

  it("normalizes mcp_tool_call to tool.started, tool.completed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.mcp_tool_call));
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.started");
    expect(types).toContain("tool.completed");
  });

  it("normalizes web_search to tool.started, tool.completed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.web_search));
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.started");
    expect(types).toContain("tool.completed");
  });

  it("normalizes todo_list to todo.updated", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.todo_list));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("todo.updated");
  });

  it("normalizes error item to tool.failed", () => {
    const events = normalizeCodexEvent(makeInput(itemEvents.error));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.failed");
  });

  it("normalizes error event to run.failed", () => {
    const events = normalizeCodexEvent(makeInput(errorEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.failed");
  });

  it("preserves raw event in data.raw", () => {
    const raw = sessionLifecycleEvents[0];
    const events = normalizeCodexEvent(makeInput(raw));
    expect(events[0]!.data.raw).toEqual(raw);
  });

  it("returns at least one daemon event", () => {
    const events = normalizeCodexEvent(makeInput({ type: "unknown" }));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("unknown");
  });
});
