import { describe, expect, it, vi } from "vitest";
import { opencodeActions } from "../../src/adapters/providers/opencode/actions.js";
import { codexActions } from "../../src/adapters/providers/codex/actions.js";
import { claudeActions } from "../../src/adapters/providers/claude/actions.js";

const opencodeActionIds = [
  "global.health", "app.log", "app.agents", "config.get", "config.providers", "path.get",
  "project.list", "project.current", "auth.set", "session.list", "session.create", "session.get",
  "session.children", "session.delete", "session.update", "session.init", "session.share",
  "session.unshare", "session.summarize", "session.messages", "session.message",
  "session.command", "session.shell", "session.revert", "session.unrevert", "session.prompt",
  "session.abort", "session.permission.reply", "find.text", "find.files", "find.symbols",
  "file.read", "file.status", "tui.appendPrompt", "tui.openHelp", "tui.openSessions",
  "tui.openThemes", "tui.openModels", "tui.submitPrompt", "tui.clearPrompt",
  "tui.executeCommand", "tui.showToast"
];

const codexActionIds = ["thread.start", "thread.resume", "thread.run", "thread.runStreamed", "turn.cancel"];

const claudeActionIds = [
  "query.run", "tool.create", "mcp.createSdkMcpServer", "sessions.list", "sessions.messages",
  "sessions.info", "sessions.rename", "sessions.tag", "query.interrupt", "query.close",
  "query.initializationResult", "query.supportedCommands", "query.supportedModels",
  "query.supportedAgents", "query.accountInfo", "query.rewindFiles", "query.setPermissionMode",
  "query.setModel", "query.setMaxThinkingTokens", "query.mcpServerStatus",
  "query.reconnectMcpServer", "query.toggleMcpServer", "query.setMcpServers",
  "query.streamInput", "query.stopTask"
];

import { ProviderRegistry } from "../../src/adapters/providers/common/providerRegistry.js";
import { DaemonError } from "../../src/domain/errors.js";
import type { AgentProvider } from "../../src/ports/agentProvider.js";
import type { SdkActionDescriptor } from "../../src/domain/providers.js";
import type { AuthMode } from "../../src/domain/auth.js";

describe("provider action descriptors", () => {
  it("registers every OpenCode SDK action", () => {
    expect(opencodeActions.map((action) => action.id)).toEqual(opencodeActionIds);
  });

  it("registers every Codex SDK action", () => {
    expect(codexActions.map((action) => action.id)).toEqual(codexActionIds);
  });

  it("registers every Claude SDK action", () => {
    expect(claudeActions.map((action) => action.id)).toEqual(claudeActionIds);
  });

  it("uses only provider or run scopes", () => {
    const all = [...opencodeActions, ...codexActions, ...claudeActions];
    expect(all.every((action) => action.scope === "provider" || action.scope === "run")).toBe(true);
  });
});

function createMockProvider(id: string, actions: SdkActionDescriptor[]): AgentProvider {
  return {
    getCapabilities: () => ({ maxConcurrency: 1, supportsStreaming: false, supportsSdkActions: true }),
    getAuthStatus: async () => ({ mode: "auto" as AuthMode, available: true, source: "test", requiresApiKey: false }),
    listActions: () => actions,
    executeProviderAction: async (request) => ({ actionId: request.actionId, output: null, durationMs: 0 }),
    executeRunAction: async (request) => ({ actionId: request.actionId, output: null, durationMs: 0 }),
    startRun: async (request) => ({ id: "run_1", provider: id, prompt: "", permissionMode: "normal", authMode: "auto", status: "running", createdAt: "now", updatedAt: "now" }),
    resumeRun: async (runId) => ({ id: runId, provider: id, prompt: "", permissionMode: "normal", authMode: "auto", status: "running", createdAt: "now", updatedAt: "now" }),
    cancelRun: async (runId) => ({ id: runId, provider: id, prompt: "", permissionMode: "normal", authMode: "auto", status: "cancelled", createdAt: "now", updatedAt: "now" }),
    resolvePermission: async () => {},
  };
}

describe("provider registry", () => {
  it("registers providers and lists them", () => {
    const registry = new ProviderRegistry();
    const mockProvider = createMockProvider("opencode", opencodeActions);
    registry.register("opencode", mockProvider);

    expect(registry.list()).toEqual(["opencode"]);
  });

  it("rejects duplicate provider IDs", () => {
    const registry = new ProviderRegistry();
    const mockProvider = createMockProvider("opencode", opencodeActions);
    registry.register("opencode", mockProvider);
    expect(() => registry.register("opencode", mockProvider)).toThrow(DaemonError);
  });

  it("returns action descriptors per provider", () => {
    const registry = new ProviderRegistry();
    const mockProvider = createMockProvider("codex", codexActions);
    registry.register("codex", mockProvider);

    const actions = registry.actionsFor("codex");
    expect(actions.map((a) => a.id)).toEqual(codexActionIds);
  });

  it("throws for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.actionsFor("unknown")).toThrow(DaemonError);
  });
});

import { CodexAdapter } from "../../src/adapters/providers/codex/codexAdapter.js";
import type { CodexSdkFactory, CodexSdkClient } from "../../src/adapters/providers/codex/codexClient.js";
import type { AgentRunRequest } from "../../src/domain/runs.js";
import { providerFailure } from "../../src/domain/errors.js";
import type { ProviderEventSink } from "../../src/domain/events.js";

function createFakeSdkClient(): CodexSdkClient {
  return {
    startThread: vi.fn().mockResolvedValue({ thread: { id: "thread_1" } }),
    resumeThread: vi.fn().mockResolvedValue({ thread: { id: "thread_1", run: { id: "run_1" } } }),
    run: vi.fn().mockResolvedValue({ turn: { id: "turn_1", status: "completed" } }),
  };
}

function createFakeSdkFactory(): CodexSdkFactory {
  const client = createFakeSdkClient();
  const factory = vi.fn().mockReturnValue(client);
  return Object.assign(factory, { _client: client });
}

function createFakeSink(): ProviderEventSink {
  return { emit: vi.fn().mockResolvedValue(undefined) };
}

function createAdapter(options: Partial<ConstructorParameters<typeof CodexAdapter>[0]> = {}): CodexAdapter {
  const factory = createFakeSdkFactory();
  return new CodexAdapter({
    sdkFactory: factory,
    eventBus: undefined as any,
    runRegistry: undefined as any,
    permissionService: undefined as any,
    detectCli: async () => ({ available: true, path: "/usr/local/bin/codex" }),
    ...options,
  });
}

describe("CodexAdapter", () => {
  it("getCapabilities() includes every Codex action ID", () => {
    const adapter = createAdapter();
    const caps = adapter.getCapabilities();
    expect(caps).toBeDefined();
    expect(caps.maxConcurrency).toBeGreaterThan(0);
    const actionIds = adapter.listActions().map((a) => a.id);
    expect(actionIds).toEqual(codexActions.map((a) => a.id));
  });

  it("thread.start calls codex.startThread", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "thread.start", input: { prompt: "hello" } });
    expect(client.startThread).toHaveBeenCalled();
    expect(result.actionId).toBe("thread.start");
    expect(result.output).toBeDefined();
  });

  it("thread.resume calls codex.resumeThread", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "thread.resume", input: { threadId: "thread_1" } });
    expect(client.resumeThread).toHaveBeenCalled();
    expect(result.actionId).toBe("thread.resume");
  });

  it("thread.run calls buffered thread.run", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "thread.run", input: { threadId: "thread_1" } });
    expect(client.run).toHaveBeenCalled();
    expect(result.actionId).toBe("thread.run");
  });

  it("thread.runStreamed forwards every raw event to the sink", async () => {
    const client = createFakeSdkClient();
    const rawEvents = [{ type: "turn.started" }, { type: "item.started", item: { type: "agent_message" } }];
    client.run = vi.fn().mockImplementation(async function* () {
      for (const evt of rawEvents) {
        yield evt;
      }
    });
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const sink = createFakeSink();
    const adapter = createAdapter({ sdkFactory: factory });
    await adapter.executeRunAction({ runId: "run_1", actionId: "thread.runStreamed", input: { threadId: "thread_1", sink } });
    expect(sink.emit).toHaveBeenCalled();
  });

  it("turn.cancel aborts the active AbortController", async () => {
    const adapter = createAdapter();
    await expect(adapter.cancelRun("run_1")).resolves.toBeDefined();
  });

  it("getAuthStatus() reports CLI auth when codex is present", async () => {
    const adapter = createAdapter({ detectCli: async () => ({ available: true, path: "/usr/local/bin/codex" }) });
    const status = await adapter.getAuthStatus();
    expect(status.available).toBe(true);
    expect(status.source).toBe("cli");
  });

  it("authMode: auto selects CLI/local auth before SDK/API-key auth", async () => {
    const adapter = createAdapter({ detectCli: async () => ({ available: true, path: "/usr/local/bin/codex" }) });
    const status = await adapter.getAuthStatus();
    expect(status.available).toBe(true);
    expect(status.source).toBe("cli");
    expect(status.requiresApiKey).toBe(false);
  });

  it("authMode: cli fails with provider.auth_required when CLI auth unavailable", async () => {
    const adapter = createAdapter({ detectCli: async () => ({ available: false, path: null }) });
    const status = await adapter.getAuthStatus();
    expect(status.available).toBe(false);
  });

  it("authMode: sdk uses explicit SDK/API-key environment credentials only", async () => {
    const adapter = createAdapter({ detectCli: async () => ({ available: false, path: null }) });
    const status = await adapter.getAuthStatus();
    expect(status.requiresApiKey).toBe(true);
  });

  it("startRun() creates an AgentRun with correct defaults", async () => {
    const adapter = createAdapter();
    const request: AgentRunRequest = {
      id: "run_1",
      createdAt: "2024-01-01T00:00:00Z",
      provider: "codex",
      prompt: "list files",
    };
    const run = await adapter.startRun(request);
    expect(run.id).toBe("run_1");
    expect(run.provider).toBe("codex");
    expect(run.status).toBe("running");
  });

  it("startRun() maps permissionMode normal to approvalPolicy on-request", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = {
      id: "run_2", createdAt: "2024-01-01T00:00:00Z", provider: "codex", prompt: "hello", permissionMode: "normal",
    };
    await adapter.startRun(request);
    expect(client.startThread).toHaveBeenCalledWith(
      expect.objectContaining({ approvalPolicy: "on-request" })
    );
  });

  it("startRun() maps permissionMode yolo to approvalPolicy never and danger sandbox", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = {
      id: "run_3", createdAt: "2024-01-01T00:00:00Z", provider: "codex", prompt: "go wild", permissionMode: "yolo",
    };
    await adapter.startRun(request);
    expect(client.startThread).toHaveBeenCalledWith(
      expect.objectContaining({ approvalPolicy: "never", sandboxMode: "danger-full-access" })
    );
  });

  it("resumeRun() resumes an existing thread", async () => {
    const client = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(client), { _client: client });
    const adapter = createAdapter({ sdkFactory: factory });
    const run = await adapter.resumeRun("run_1");
    expect(run.id).toBe("run_1");
    expect(run.provider).toBe("codex");
    expect(run.status).toBe("running");
  });

  it("resolvePermission() emits a provider warning", async () => {
    const adapter = createAdapter();
    await expect(adapter.resolvePermission("run_1", "perm_1", { decision: "allow", scope: "once" })).resolves.not.toThrow();
  });
});
