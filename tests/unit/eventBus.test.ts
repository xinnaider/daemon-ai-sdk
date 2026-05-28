import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/application/eventBus.js";
import { encodeSseFrame } from "../../src/adapters/http/sse.js";

describe("EventBus", () => {
  it("replays prior run events before live events", () => {
    const bus = new EventBus({ bufferSize: 5 });
    bus.publish({ id: "evt_1", runId: "run_1", provider: "codex", type: "run.created", createdAt: "a", sequence: 1, data: {} });
    bus.publish({ id: "evt_2", runId: "run_2", provider: "claude", type: "run.created", createdAt: "b", sequence: 1, data: {} });

    expect(bus.replay("run_1").map((event) => event.id)).toEqual(["evt_1"]);
  });

  it("encodes SSE frames with id, event, and JSON data", () => {
    const frame = encodeSseFrame({
      id: "evt_1",
      runId: "run_1",
      provider: "opencode",
      type: "message.delta",
      createdAt: "now",
      sequence: 2,
      data: { text: "hi" }
    });

    expect(frame).toContain("id: evt_1\n");
    expect(frame).toContain("event: message.delta\n");
    expect(frame).toContain('"text":"hi"');
  });
});
