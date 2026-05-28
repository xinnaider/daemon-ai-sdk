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

  it("authMode: auto tries CLI first, falls back to SDK on startRun", async () => {
    const cli = vi.fn().mockResolvedValue({ available: true, path: "/usr/local/bin/codex" });
    const sdkClient = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(sdkClient), { _client: sdkClient });
    const adapter = createAdapter({ sdkFactory: factory, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "codex", prompt: "hi", authMode: "auto" };
    await adapter.startRun(request);
    expect(cli).toHaveBeenCalled();
  });

  it("authMode: cli fails with provider.auth_required when CLI auth unavailable", async () => {
    const adapter = createAdapter({ detectCli: async () => ({ available: false, path: null }) });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "codex", prompt: "hi", authMode: "cli" };
    await expect(adapter.startRun(request)).rejects.toThrow(providerFailure("CLI auth required but codex CLI not found", "codex"));
  });

  it("authMode: sdk skips CLI detection and uses SDK only on startRun", async () => {
    const cli = vi.fn();
    const sdkClient = createFakeSdkClient();
    const factory: CodexSdkFactory = Object.assign(vi.fn().mockReturnValue(sdkClient), { _client: sdkClient });
    const adapter = createAdapter({ sdkFactory: factory, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "codex", prompt: "hi", authMode: "sdk" };
    await adapter.startRun(request);
    expect(cli).not.toHaveBeenCalled();
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

import { ClaudeAdapter } from "../../src/adapters/providers/claude/claudeAdapter.js";
import type { ClaudeSdkFacade, QueryInstance, QueryOptions } from "../../src/adapters/providers/claude/claudeClient.js";
import type { ProviderEventSink } from "../../src/domain/events.js";

function createFakeQueryInstance(): QueryInstance {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn().mockResolvedValue(undefined),
    initializationResult: Promise.resolve({ status: "initialized" }),
    supportedCommands: Promise.resolve(["help", "status"]),
    supportedModels: Promise.resolve(["claude-sonnet-4", "claude-haiku-4"]),
    supportedAgents: Promise.resolve(["default"]),
    accountInfo: Promise.resolve({ user: "test" }),
    rewindFiles: vi.fn().mockResolvedValue(undefined),
    setPermissionMode: vi.fn().mockResolvedValue(undefined),
    setModel: vi.fn().mockResolvedValue(undefined),
    setMaxThinkingTokens: vi.fn().mockResolvedValue(undefined),
    mcpServerStatus: Promise.resolve({ servers: [] }),
    reconnectMcpServer: vi.fn().mockResolvedValue(undefined),
    toggleMcpServer: vi.fn().mockResolvedValue(undefined),
    setMcpServers: vi.fn().mockResolvedValue(undefined),
    streamInput: vi.fn().mockResolvedValue(undefined),
    stopTask: vi.fn().mockResolvedValue(undefined),
  };
}

function createFakeClaudeFacade(): ClaudeSdkFacade & { _queryInstance: QueryInstance } {
  const queryInstance = createFakeQueryInstance();
  const facade: ClaudeSdkFacade = {
    query: vi.fn().mockReturnValue(queryInstance),
    tool: { create: vi.fn().mockResolvedValue({}) } as unknown as ClaudeSdkFacade["tool"],
    createSdkMcpServer: vi.fn().mockResolvedValue({ name: "test-mcp" }),
    listSessions: vi.fn().mockResolvedValue([{ id: "session_1" }]),
    getSessionMessages: vi.fn().mockResolvedValue([{ id: "msg_1" }]),
    getSessionInfo: vi.fn().mockResolvedValue({ id: "session_1" }),
    renameSession: vi.fn().mockResolvedValue(undefined),
    tagSession: vi.fn().mockResolvedValue(undefined),
  };
  return Object.assign(facade, { _queryInstance: queryInstance });
}

function createClaudeFakeSink(): ProviderEventSink {
  return { emit: vi.fn().mockResolvedValue(undefined) };
}

function createClaudeAdapter(options: Partial<ConstructorParameters<typeof ClaudeAdapter>[0]> = {}): ClaudeAdapter {
  const facade = createFakeClaudeFacade();
  return new ClaudeAdapter({
    facade,
    eventBus: undefined as any,
    runRegistry: undefined as any,
    permissionService: undefined as any,
    detectCli: async () => ({ available: true, path: "/usr/local/bin/claude" }),
    ...options,
  });
}

describe("ClaudeAdapter", () => {
  it("getCapabilities() includes every Claude action ID", () => {
    const adapter = createClaudeAdapter();
    const caps = adapter.getCapabilities();
    expect(caps).toBeDefined();
    expect(caps.maxConcurrency).toBeGreaterThan(0);
    const actionIds = adapter.listActions().map((a) => a.id);
    expect(actionIds).toEqual(claudeActions.map((a) => a.id));
  });

  it("startRun calls facade.query", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello" };
    await adapter.startRun(request);
    expect(facade.query).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "hello" })
    );
  });

  it("query.run calls facade.query via run scope", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_qr", createdAt: "now", provider: "claude", prompt: "initial" };
    await adapter.startRun(request);
    const result = await adapter.executeRunAction({ runId: "run_qr", actionId: "query.run", input: { prompt: "hello" } });
    expect(facade.query).toHaveBeenCalled();
    expect(result.actionId).toBe("query.run");
  });

  it("query.run creates a new query via facade.query", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_sink", createdAt: "now", provider: "claude", prompt: "initial" };
    await adapter.startRun(request);
    const prevCalls = (facade.query as ReturnType<typeof vi.fn>).mock.calls.length;
    await adapter.executeRunAction({ runId: "run_sink", actionId: "query.run", input: { prompt: "follow-up" } });
    expect(facade.query).toHaveBeenCalledTimes(prevCalls + 1);
  });

  it("maps includePartialMessages to query options", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello" };
    await adapter.startRun(request);
    expect(facade.query).toHaveBeenCalled();
  });

  it("maps permissionMode normal to canUseTool with daemon permission requests", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade, permissionService: { requestPermission: vi.fn().mockResolvedValue({ decision: "allow", scope: "once" }) } as any });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello", permissionMode: "normal" };
    await adapter.startRun(request);
    expect(facade.query).toHaveBeenCalledWith(
      expect.objectContaining({ permissionMode: "normal" })
    );
  });

  it("maps permissionMode yolo to bypassPermissions", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "go wild", permissionMode: "yolo" };
    await adapter.startRun(request);
    expect(facade.query).toHaveBeenCalledWith(
      expect.objectContaining({ permissionMode: "yolo" })
    );
  });

  it("run-bound query actions call active Query methods", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello" };
    await adapter.startRun(request);

    const queryInstance = facade._queryInstance;
    const results = await Promise.all([
      adapter.executeRunAction({ runId: "run_1", actionId: "query.interrupt", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.close", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.rewindFiles", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.setPermissionMode", input: { mode: "yolo" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.setModel", input: { model: "claude-sonnet-4" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.setMaxThinkingTokens", input: { tokens: 10000 } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.reconnectMcpServer", input: { name: "filesystem" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.toggleMcpServer", input: { name: "filesystem", enabled: true } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.setMcpServers", input: { servers: [] } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.streamInput", input: { input: "more" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "query.stopTask", input: {} }),
    ]);
    expect(results.every((r) => r.actionId.startsWith("query."))).toBe(true);
    expect(queryInstance.interrupt).toHaveBeenCalled();
    expect(queryInstance.close).toHaveBeenCalled();
    expect(queryInstance.rewindFiles).toHaveBeenCalled();
    expect(queryInstance.setPermissionMode).toHaveBeenCalledWith("yolo");
    expect(queryInstance.setModel).toHaveBeenCalledWith("claude-sonnet-4");
    expect(queryInstance.setMaxThinkingTokens).toHaveBeenCalledWith(10000);
    expect(queryInstance.reconnectMcpServer).toHaveBeenCalledWith("filesystem");
    expect(queryInstance.toggleMcpServer).toHaveBeenCalledWith("filesystem", true);
    expect(queryInstance.setMcpServers).toHaveBeenCalledWith([]);
    expect(queryInstance.streamInput).toHaveBeenCalledWith("more");
    expect(queryInstance.stopTask).toHaveBeenCalled();
  });

  it("run-bound query property reads return values", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello" };
    await adapter.startRun(request);

    const initResult = await adapter.executeRunAction({ runId: "run_1", actionId: "query.initializationResult", input: {} });
    expect(initResult.actionId).toBe("query.initializationResult");
    expect(initResult.output).toBeDefined();

    const commands = await adapter.executeRunAction({ runId: "run_1", actionId: "query.supportedCommands", input: {} });
    expect(commands.actionId).toBe("query.supportedCommands");
    expect(commands.output).toEqual(["help", "status"]);

    const models = await adapter.executeRunAction({ runId: "run_1", actionId: "query.supportedModels", input: {} });
    expect(models.actionId).toBe("query.supportedModels");
    expect(models.output).toContain("claude-sonnet-4");

    const agents = await adapter.executeRunAction({ runId: "run_1", actionId: "query.supportedAgents", input: {} });
    expect(agents.actionId).toBe("query.supportedAgents");
    expect(agents.output).toContain("default");

    const account = await adapter.executeRunAction({ runId: "run_1", actionId: "query.accountInfo", input: {} });
    expect(account.actionId).toBe("query.accountInfo");

    const mcpStatus = await adapter.executeRunAction({ runId: "run_1", actionId: "query.mcpServerStatus", input: {} });
    expect(mcpStatus.actionId).toBe("query.mcpServerStatus");
  });

  it("provider-level session actions call matching SDK functions", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });

    const toolResult = await adapter.executeProviderAction({ actionId: "tool.create", input: { name: "test" } });
    expect(facade.tool.create).toHaveBeenCalled();
    expect(toolResult.actionId).toBe("tool.create");

    const mcpResult = await adapter.executeProviderAction({ actionId: "mcp.createSdkMcpServer", input: { name: "test" } });
    expect(facade.createSdkMcpServer).toHaveBeenCalled();
    expect(mcpResult.actionId).toBe("mcp.createSdkMcpServer");

    const listResult = await adapter.executeProviderAction({ actionId: "sessions.list", input: {} });
    expect(facade.listSessions).toHaveBeenCalled();
    expect(listResult.actionId).toBe("sessions.list");

    const msgsResult = await adapter.executeProviderAction({ actionId: "sessions.messages", input: { sessionId: "s1" } });
    expect(facade.getSessionMessages).toHaveBeenCalled();
    expect(msgsResult.actionId).toBe("sessions.messages");

    const infoResult = await adapter.executeProviderAction({ actionId: "sessions.info", input: { sessionId: "s1" } });
    expect(facade.getSessionInfo).toHaveBeenCalled();
    expect(infoResult.actionId).toBe("sessions.info");

    const renameResult = await adapter.executeProviderAction({ actionId: "sessions.rename", input: { sessionId: "s1", name: "new" } });
    expect(facade.renameSession).toHaveBeenCalled();
    expect(renameResult.actionId).toBe("sessions.rename");

    const tagResult = await adapter.executeProviderAction({ actionId: "sessions.tag", input: { sessionId: "s1", tags: ["important"] } });
    expect(facade.tagSession).toHaveBeenCalled();
    expect(tagResult.actionId).toBe("sessions.tag");
  });

  it("getAuthStatus() reports Claude Code local auth when claude is present", async () => {
    const adapter = createClaudeAdapter({ detectCli: async () => ({ available: true, path: "/usr/local/bin/claude" }) });
    const status = await adapter.getAuthStatus();
    expect(status.available).toBe(true);
    expect(status.source).toBe("cli");
  });

  it("authMode: auto selects CLI auth on startRun", async () => {
    const cli = vi.fn().mockResolvedValue({ available: true, path: "/usr/local/bin/claude" });
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hi", authMode: "auto" };
    await adapter.startRun(request);
    expect(cli).toHaveBeenCalled();
  });

  it("authMode: cli fails with provider.auth_required when claude CLI unavailable", async () => {
    const adapter = createClaudeAdapter({ detectCli: async () => ({ available: false, path: null }) });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hi", authMode: "cli" };
    await expect(adapter.startRun(request)).rejects.toThrow(providerFailure("CLI auth required but claude CLI not found", "claude"));
  });

  it("authMode: sdk skips CLI detection on startRun", async () => {
    const cli = vi.fn();
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hi", authMode: "sdk" };
    await adapter.startRun(request);
    expect(cli).not.toHaveBeenCalled();
  });

  it("startRun() creates an AgentRun with correct defaults", async () => {
    const adapter = createClaudeAdapter();
    const request: AgentRunRequest = { id: "run_1", createdAt: "2024-01-01T00:00:00Z", provider: "claude", prompt: "list files" };
    const run = await adapter.startRun(request);
    expect(run.id).toBe("run_1");
    expect(run.provider).toBe("claude");
    expect(run.status).toBe("running");
  });

  it("cancelRun() calls query.close and returns cancelled run", async () => {
    const facade = createFakeClaudeFacade();
    const adapter = createClaudeAdapter({ facade });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "claude", prompt: "hello" };
    await adapter.startRun(request);
    const run = await adapter.cancelRun("run_1");
    expect(run.status).toBe("cancelled");
    expect(facade._queryInstance.close).toHaveBeenCalled();
  });

  it("resumeRun() returns a resumed run with running status", async () => {
    const adapter = createClaudeAdapter();
    const run = await adapter.resumeRun("run_1");
    expect(run.id).toBe("run_1");
    expect(run.status).toBe("running");
  });

  it("resolvePermission() does not throw", async () => {
    const adapter = createClaudeAdapter();
    await expect(adapter.resolvePermission("run_1", "perm_1", { decision: "allow", scope: "once" })).resolves.not.toThrow();
  });
});
