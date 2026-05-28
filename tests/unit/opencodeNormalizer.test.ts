import { describe, expect, it } from "vitest";
import type { NormalizeInput } from "../../src/application/eventNormalizer.js";
import { normalizeOpenCodeEvent } from "../../src/adapters/providers/opencode/opencodeNormalizer.js";
import {
  sessionLifecycleEvents,
  messageLifecycleEvents,
  partTextDeltaEvent,
  toolStartEvent,
  toolUpdateEvent,
  toolFinishEvent,
  permissionRequestEvent,
  permissionReplyEvent,
  fileStatusUpdateEvent,
  errorEvent,
  tokensCostEvent,
  childSessionEvent,
  unknownEvent,
} from "../fixtures/opencodeEvents.js";

function makeInput(raw: unknown, runId = "run_1", sequence = 1): NormalizeInput {
  return {
    provider: "opencode",
    raw,
    runId,
    sequence,
  };
}

describe("opencodeNormalizer", () => {
  it("normalizes session.created to session.discovered", () => {
    const events = normalizeOpenCodeEvent(makeInput(sessionLifecycleEvents[0]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("session.discovered");
  });

  it("normalizes session.updated to session.updated", () => {
    const events = normalizeOpenCodeEvent(makeInput(sessionLifecycleEvents[1]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("session.updated");
  });

  it("normalizes session.deleted to session.deleted", () => {
    const events = normalizeOpenCodeEvent(makeInput(sessionLifecycleEvents[2]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("session.deleted");
  });

  it("normalizes message.created to message.started", () => {
    const events = normalizeOpenCodeEvent(makeInput(messageLifecycleEvents[0]));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("message.started");
  });

  it("normalizes message.updated to message.delta, message.completed", () => {
    const events = normalizeOpenCodeEvent(makeInput(messageLifecycleEvents[1]));
    const types = events.map((e) => e.type);
    expect(types).toContain("message.delta");
    expect(types).toContain("message.completed");
  });

  it("normalizes part.text_delta to message.delta", () => {
    const events = normalizeOpenCodeEvent(makeInput(partTextDeltaEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("message.delta");
  });

  it("normalizes tool.start to tool.started", () => {
    const events = normalizeOpenCodeEvent(makeInput(toolStartEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.started");
  });

  it("normalizes tool.update to tool.delta", () => {
    const events = normalizeOpenCodeEvent(makeInput(toolUpdateEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.delta");
  });

  it("normalizes tool.finish to tool.completed", () => {
    const events = normalizeOpenCodeEvent(makeInput(toolFinishEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("tool.completed");
  });

  it("normalizes permission.request to permission.requested", () => {
    const events = normalizeOpenCodeEvent(makeInput(permissionRequestEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("permission.requested");
  });

  it("normalizes permission.reply to permission.resolved", () => {
    const events = normalizeOpenCodeEvent(makeInput(permissionReplyEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("permission.resolved");
  });

  it("normalizes file.status_update to file.changed", () => {
    const events = normalizeOpenCodeEvent(makeInput(fileStatusUpdateEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("file.changed");
  });

  it("normalizes error to run.failed", () => {
    const events = normalizeOpenCodeEvent(makeInput(errorEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("run.failed");
  });

  it("normalizes tokens.cost to usage.updated", () => {
    const events = normalizeOpenCodeEvent(makeInput(tokensCostEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("usage.updated");
  });

  it("normalizes child_session to session.discovered", () => {
    const events = normalizeOpenCodeEvent(makeInput(childSessionEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("session.discovered");
  });

  it("normalizes unknown events to unknown", () => {
    const events = normalizeOpenCodeEvent(makeInput(unknownEvent));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe("unknown");
  });

  it("preserves raw event in data.raw", () => {
    const events = normalizeOpenCodeEvent(makeInput(toolStartEvent));
    expect(events[0]!.data.raw).toEqual(toolStartEvent);
  });

  it("returns at least one daemon event", () => {
    const events = normalizeOpenCodeEvent(makeInput({ type: "bogus" }));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
