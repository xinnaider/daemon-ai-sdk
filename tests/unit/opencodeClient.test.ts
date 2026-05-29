import { describe, expect, it, vi } from "vitest";
import { wrapOpencodeClient } from "../../src/adapters/providers/opencode/opencodeClient.js";

function ok<T>(data: T) {
  return Promise.resolve({ data });
}

describe("OpenCode SDK wrapper", () => {
  it("maps global.health to config.get because the SDK has no global.health method", async () => {
    const client = {
      config: {
        get: vi.fn().mockReturnValue(ok({ version: "test" })),
      },
    };

    const wrapped = wrapOpencodeClient(client);
    await expect(wrapped.global.health()).resolves.toEqual({
      status: "ok",
      config: { version: "test" },
    });
    expect(client.config.get).toHaveBeenCalledWith();
  });

  it("sends session prompt as SDK path/body options", async () => {
    const client = {
      session: {
        prompt: vi.fn().mockReturnValue(ok({ id: "message_1" })),
      },
    };

    const wrapped = wrapOpencodeClient(client);
    await wrapped.session.prompt("session_1", { prompt: "hello" });

    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: "session_1" },
      body: { parts: [{ type: "text", text: "hello" }] },
    });
  });
});
