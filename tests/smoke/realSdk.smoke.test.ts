import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildDaemon } from "../../src/main.js";
import type { DaemonRuntime } from "../../src/main.js";

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
const hasClaudeOAuth = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
const hasCodexKey = !!process.env.CODEX_API_KEY;

const runSuite = describe.skipIf(!process.env.RUN_REAL_SDK_TESTS);

runSuite("Real SDK Smoke Tests", () => {
  let runtime: DaemonRuntime;

  beforeAll(async () => {
    runtime = buildDaemon();
    await runtime.server.ready();
  });

  afterAll(async () => {
    await runtime.server.close();
  });

  it("GET /providers returns all three adapters with auth status", async () => {
    const res = await runtime.server.inject({ method: "GET", url: "/providers" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providers).toHaveLength(3);

    const ids = body.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain("opencode");
    expect(ids).toContain("claude");
    expect(ids).toContain("codex");

    for (const p of body.providers) {
      expect(p).toHaveProperty("auth");
      expect(p.auth).toHaveProperty("available");
      expect(p.auth).toHaveProperty("source");
      expect(p.auth).toHaveProperty("requiresApiKey");
    }
  });

  it("Claude auth status does not throw", async () => {
    const status = await runtime.providers.authStatusFor("claude");
    expect(status.mode).toBe("auto");
  });

  const claudeQuerySuite = describe.skipIf(
    () => !hasAnthropicKey && !hasClaudeOAuth
  );

  claudeQuerySuite("Claude SDK query (requires credentials)", () => {
    it("returns initialization result for a minimal prompt", async () => {
      const run = await runtime.execution.startRun({
        id: "smoke_claude_run",
        createdAt: new Date().toISOString(),
        provider: "claude",
        prompt: "respond with only the word hello",
        authMode: "auto",
        permissionMode: "yolo",
      });
      expect(run.status).toBe("running");
      expect(run.provider).toBe("claude");
    });
  });

  it("Codex auth status does not throw", async () => {
    const status = await runtime.providers.authStatusFor("codex");
    expect(status.mode).toBe("auto");
  });

  const codexRunSuite = describe.skipIf(
    () => !hasOpenAiKey && !hasCodexKey
  );

  codexRunSuite("Codex SDK run (requires credentials)", () => {
    it("starts a thread with minimal prompt", async () => {
      const run = await runtime.execution.startRun({
        id: "smoke_codex_run",
        createdAt: new Date().toISOString(),
        provider: "codex",
        prompt: "respond with only the word hello",
        authMode: "auto",
        permissionMode: "yolo",
      });
      expect(run.status).toBe("running");
      expect(run.provider).toBe("codex");
    });
  });

  it("OpenCode auth status check returns a result", async () => {
    const status = await runtime.providers.authStatusFor("opencode");
    expect(status).toHaveProperty("available");
    expect(status).toHaveProperty("source");
    expect(status).toHaveProperty("requiresApiKey");
  });

  it("Event streaming - EventBus publishes and replays events", async () => {
    const testEvent = {
      id: "evt_smoke_1",
      type: "smoke.test" as const,
      provider: "opencode" as const,
      runId: "smoke_event_test",
      createdAt: new Date().toISOString(),
      data: { msg: "hello" },
      sequence: 1,
    };

    runtime.events.publish(testEvent);

    const replayed = runtime.events.replay("smoke_event_test");
    expect(replayed.length).toBeGreaterThanOrEqual(1);
    const last = replayed[replayed.length - 1];
    expect(last).toBeDefined();
    expect(last!.type).toBe("smoke.test");
  });

  it("Error handling - unknown provider returns 404", async () => {
    const res = await runtime.server.inject({
      method: "GET",
      url: "/providers/unknown/actions",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error");
  });

  it("Error handling - daemon builds without any API keys", async () => {
    expect(runtime.server).toBeDefined();
    expect(runtime.providers.list()).toEqual(["opencode", "claude", "codex"]);
  });
});
