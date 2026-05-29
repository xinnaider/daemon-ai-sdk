import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDaemon } from "../../src/main.js";
import type { DaemonRuntime } from "../../src/main.js";

const runSuite = describe.skipIf(!process.env.RUN_REAL_OPENCODE_HTTP_TESTS);

runSuite("OpenCode HTTP/SSE smoke", () => {
  let runtime: DaemonRuntime;
  let baseUrl: string;

  beforeAll(async () => {
    runtime = buildDaemon();
    await runtime.server.listen({ port: 0, host: "127.0.0.1" });
    const address = runtime.server.server.address();
    if (typeof address === "string" || address === null) {
      throw new Error("Expected TCP listen address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await runtime.server.close();
  });

  it("starts an OpenCode run and streams full daemon event envelopes", async () => {
    const create = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "opencode",
        prompt: "Reply exactly OK",
        permissionMode: "yolo",
      }),
    });

    expect(create.status).toBe(201);
    const run = (await create.json()) as { id: string; status: string };
    expect(run.id).toMatch(/^run_/);
    expect(run.status).toBe("running");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const stream = await fetch(`${baseUrl}/runs/${run.id}/events`, { signal: controller.signal });
    expect(stream.status).toBe(200);

    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      while (!text.includes("message.delta") && !text.includes("message.completed")) {
        const next = await reader.read();
        if (next.done) break;
        text += decoder.decode(next.value, { stream: true });
      }
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }

    expect(text).toContain(`"runId":"${run.id}"`);
    expect(text).toContain("\"provider\":\"opencode\"");
  }, 20_000);
});
