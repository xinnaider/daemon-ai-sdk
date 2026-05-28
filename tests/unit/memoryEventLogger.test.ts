import { describe, expect, it } from "vitest";
import { MemoryEventLogger } from "../../src/adapters/logging/memoryEventLogger.js";

describe("MemoryEventLogger", () => {
  it("stores redacted log entries in insertion order", async () => {
    const logger = new MemoryEventLogger({ maxEntries: 10, echoToConsole: false });

    await logger.log({
      id: "log_1",
      createdAt: "2026-05-28T00:00:00.000Z",
      level: "info",
      kind: "request.input",
      message: "run requested",
      data: { apiKey: "secret", prompt: "hello" }
    });

    expect(await logger.list()).toEqual([
      expect.objectContaining({
        data: { apiKey: "[REDACTED]", prompt: "hello" }
      })
    ]);
  });

  it("keeps only the configured number of entries", async () => {
    const logger = new MemoryEventLogger({ maxEntries: 1, echoToConsole: false });
    await logger.log({ id: "log_1", createdAt: "a", level: "info", kind: "event.raw", message: "first" });
    await logger.log({ id: "log_2", createdAt: "b", level: "info", kind: "event.raw", message: "second" });

    expect((await logger.list()).map((entry) => entry.id)).toEqual(["log_2"]);
  });
});
