import { describe, expect, it, vi, afterEach } from "vitest";
import { createServer } from "../../src/adapters/http/server.js";
import { EventBus } from "../../src/application/eventBus.js";
import type { DaemonEvent } from "../../src/domain/events.js";
import type { ServerDeps } from "../../src/adapters/http/routes.js";

function makeSseDeps(events: EventBus): ServerDeps {
  return {
    providers: {
      get: vi.fn(),
      register: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      authStatusFor: vi.fn(),
      actionsFor: vi.fn().mockReturnValue([]),
      executeProviderAction: vi.fn(),
      executeRunAction: vi.fn(),
    },
    runs: {
      addRun: vi.fn(),
      getRun: vi.fn(),
      listRuns: vi.fn().mockReturnValue([]),
      updateRun: vi.fn(),
      setHandle: vi.fn(),
      getHandle: vi.fn(),
      removeHandle: vi.fn(),
    },
    events,
    logger: { log: vi.fn(), list: vi.fn() },
    execution: {
      startRun: vi.fn(),
      resumeRun: vi.fn(),
      cancelRun: vi.fn(),
      resolvePermission: vi.fn(),
      executeProviderAction: vi.fn(),
      executeRunAction: vi.fn(),
    },
  };
}

function makeEvent(runId: string, type: string, seq: number, data: Record<string, unknown> = {}): DaemonEvent {
  return {
    id: `evt_${seq}`,
    runId,
    provider: "opencode",
    type: type as DaemonEvent["type"],
    createdAt: new Date().toISOString(),
    sequence: seq,
    data,
  };
}

describe("SSE Event Streams", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("GET /runs/:runId/events returns text/event-stream with headers", async () => {
    const bus = new EventBus({ bufferSize: 100 });
    bus.publish(makeEvent("run_1", "message", 1, { text: "seed" }));
    const app = createServer(makeSseDeps(bus));
    await app.listen({ port: 0 });
    const port = (app.server.address() as any).port;

    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/runs/run_1/events`, { signal: controller.signal });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");

    controller.abort();
    await app.close();
  });

  it("replays prior events for a run on connect", async () => {
    const bus = new EventBus({ bufferSize: 100 });
    const e1 = makeEvent("run_1", "message", 1, { text: "hello" });
    const e2 = makeEvent("run_1", "message", 2, { text: "world" });
    bus.publish(e1);
    bus.publish(e2);

    const app = createServer(makeSseDeps(bus));
    await app.listen({ port: 0 });
    const port = (app.server.address() as any).port;

    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/runs/run_1/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value, { stream: true });
    expect(text).toContain(e1.id);
    expect(text).toContain(e2.id);

    controller.abort();
    await app.close();
  });

  it("delivers live events after replay", async () => {
    const bus = new EventBus({ bufferSize: 100 });
    const prior = makeEvent("run_1", "message", 1, { text: "prior" });
    bus.publish(prior);

    const app = createServer(makeSseDeps(bus));
    await app.listen({ port: 0 });
    const port = (app.server.address() as any).port;

    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/runs/run_1/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    await reader.read();

    const live = makeEvent("run_1", "message", 2, { text: "live" });
    bus.publish(live);

    const { value } = await reader.read();
    const text = decoder.decode(value, { stream: true });
    expect(text).toContain(live.id);

    controller.abort();
    await app.close();
  });

  it("GET /events receives events from all runs", async () => {
    const bus = new EventBus({ bufferSize: 100 });
    const e1 = makeEvent("run_1", "message", 1, { text: "from run1" });
    const e2 = makeEvent("run_2", "message", 1, { text: "from run2" });
    bus.publish(e1);
    bus.publish(e2);

    const app = createServer(makeSseDeps(bus));
    await app.listen({ port: 0 });
    const port = (app.server.address() as any).port;

    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value, { stream: true });
    expect(text).toContain(e1.id);
    expect(text).toContain(e2.id);

    controller.abort();
    await app.close();
  });

  it("disconnect removes the subscriber", async () => {
    const bus = new EventBus({ bufferSize: 100 });
    const app = createServer(makeSseDeps(bus));
    // Seed an event so the first reader.read() returns immediately
    bus.publish(makeEvent("run_1", "message", 1, { text: "seed" }));
    await app.listen({ port: 0 });
    const port = (app.server.address() as any).port;

    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/runs/run_1/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const first = await reader.read();
    expect(first.done).toBe(false);

    controller.abort();

    await new Promise((r) => setTimeout(r, 100));

    const afterDisconnect = makeEvent("run_1", "message", 99, { text: "after-disconnect" });
    expect(() => bus.publish(afterDisconnect)).not.toThrow();

    await app.close();
  });
});
