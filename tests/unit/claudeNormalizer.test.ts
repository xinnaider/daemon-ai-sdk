import { describe, expect, it } from "vitest";
import type { NormalizeInput } from "../../src/application/eventNormalizer.js";
import { normalizeClaudeMessage } from "../../src/adapters/providers/claude/claudeNormalizer.js";
import {
  assistantMessage,
  userMessage,
  resultMessage,
  systemMessage,
  streamEventMessage,
  compactBoundaryMessage,
  statusMessage,
  localCommandOutputMessage,
  hookStartedMessage,
  hookProgressMessage,
  hookResponseMessage,
  toolProgressMessage,
  authStatusMessage,
  taskNotificationMessage,
  taskStartedMessage,
  taskProgressMessage,
  filesPersistedMessage,
  toolUseSummaryMessage,
  rateLimitMessage,
  promptSuggestionMessage,
  permissionRequestMessage,
} from "../fixtures/claudeMessages.js";

function makeInput(raw: unknown, runId = "run_1", sequence = 1): NormalizeInput {
  return {
    provider: "claude",
    raw,
    runId,
    sequence,
  };
}

describe("claudeNormalizer", () => {
  it("normalizes assistant messages to message events", () => {
    const events = normalizeClaudeMessage(makeInput(assistantMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("message.started");
    const types = events.map((e) => e.type);
    expect(types).toContain("message.delta");
    expect(types).toContain("message.completed");
  });

  it("normalizes user messages to message events", () => {
    const events = normalizeClaudeMessage(makeInput(userMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("message.started");
  });

  it("normalizes result success to run.completed", () => {
    const events = normalizeClaudeMessage(makeInput(resultMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.completed");
  });

  it("normalizes result error to run.failed", () => {
    const resultError = {
      type: "result",
      result: { status: "error", error: "something broke" },
    };
    const events = normalizeClaudeMessage(makeInput(resultError));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.failed");
  });

  it("normalizes system messages to unknown", () => {
    const events = normalizeClaudeMessage(makeInput(systemMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("unknown");
  });

  it("normalizes stream_event to message.delta", () => {
    const events = normalizeClaudeMessage(makeInput(streamEventMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("message.delta");
  });

  it("normalizes compact_boundary to unknown", () => {
    const events = normalizeClaudeMessage(makeInput(compactBoundaryMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("unknown");
  });

  it("normalizes status messages to run update", () => {
    const events = normalizeClaudeMessage(makeInput(statusMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.started");
  });

  it("normalizes local_command_output to tool events", () => {
    const events = normalizeClaudeMessage(makeInput(localCommandOutputMessage));
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.started");
    expect(types).toContain("tool.completed");
  });

  it("normalizes hook_started to tool.started", () => {
    const events = normalizeClaudeMessage(makeInput(hookStartedMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.started");
  });

  it("normalizes hook_progress to tool.delta", () => {
    const events = normalizeClaudeMessage(makeInput(hookProgressMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.delta");
  });

  it("normalizes hook_response to tool.completed", () => {
    const events = normalizeClaudeMessage(makeInput(hookResponseMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.completed");
  });

  it("normalizes tool_progress to tool.delta", () => {
    const events = normalizeClaudeMessage(makeInput(toolProgressMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.delta");
  });

  it("normalizes auth_status to permission events", () => {
    const events = normalizeClaudeMessage(makeInput(authStatusMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("permission.requested");
  });

  it("normalizes permission request hooks to permission.requested", () => {
    const events = normalizeClaudeMessage(makeInput(permissionRequestMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("permission.requested");
  });

  it("normalizes task_notification to todo.updated", () => {
    const events = normalizeClaudeMessage(makeInput(taskNotificationMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("todo.updated");
  });

  it("normalizes task_started to todo.updated", () => {
    const events = normalizeClaudeMessage(makeInput(taskStartedMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("todo.updated");
  });

  it("normalizes task_progress to todo.updated", () => {
    const events = normalizeClaudeMessage(makeInput(taskProgressMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("todo.updated");
  });

  it("normalizes files_persisted to file.changed", () => {
    const events = normalizeClaudeMessage(makeInput(filesPersistedMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("file.changed");
  });

  it("normalizes tool_use_summary to usage.updated", () => {
    const events = normalizeClaudeMessage(makeInput(toolUseSummaryMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("usage.updated");
  });

  it("normalizes rate_limit to usage.updated", () => {
    const events = normalizeClaudeMessage(makeInput(rateLimitMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("usage.updated");
  });

  it("normalizes prompt_suggestion to unknown", () => {
    const events = normalizeClaudeMessage(makeInput(promptSuggestionMessage));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("unknown");
  });

  it("preserves raw event in data.raw", () => {
    const events = normalizeClaudeMessage(makeInput(assistantMessage));
    expect(events[0]!.data.raw).toEqual(assistantMessage);
  });
});
