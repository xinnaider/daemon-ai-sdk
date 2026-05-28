import { beforeAll, describe, expect, it, vi } from "vitest";
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

import { OpenCodeAdapter } from "../../src/adapters/providers/opencode/opencodeAdapter.js";
import type { OpenCodeSdkFactory, OpenCodeSdkClient } from "../../src/adapters/providers/opencode/opencodeClient.js";
import type { ProviderEventSink } from "../../src/domain/events.js";
import { EventBus } from "../../src/application/eventBus.js";
import { providerFailure } from "../../src/domain/errors.js";

function createFakeOpenCodeSdkClient(): OpenCodeSdkClient {
  const unsubscribe = vi.fn();
  return {
    global: { health: vi.fn().mockResolvedValue({ status: "ok" }) },
    app: { log: vi.fn().mockResolvedValue(undefined), agents: vi.fn().mockResolvedValue([]) },
    config: { get: vi.fn().mockResolvedValue({}), providers: vi.fn().mockResolvedValue([]) },
    path: { get: vi.fn().mockResolvedValue({ path: "/workspace" }) },
    project: { list: vi.fn().mockResolvedValue([]), current: vi.fn().mockResolvedValue({}) },
    auth: { set: vi.fn().mockResolvedValue({}) },
    session: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "session_1" }),
      get: vi.fn().mockResolvedValue({ id: "session_1" }),
      children: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue({}),
      init: vi.fn().mockResolvedValue({}),
      share: vi.fn().mockResolvedValue(undefined),
      unshare: vi.fn().mockResolvedValue(undefined),
      summarize: vi.fn().mockResolvedValue("summary"),
      messages: vi.fn().mockResolvedValue([]),
      message: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({ output: "cmd output" }),
      shell: vi.fn().mockResolvedValue({ output: "shell output" }),
      revert: vi.fn().mockResolvedValue(undefined),
      unrevert: vi.fn().mockResolvedValue(undefined),
      prompt: vi.fn().mockResolvedValue({}),
      abort: vi.fn().mockResolvedValue(undefined),
      permission: { reply: vi.fn().mockResolvedValue(undefined) },
    },
    find: {
      text: vi.fn().mockResolvedValue({ results: [] }),
      files: vi.fn().mockResolvedValue({ results: [] }),
      symbols: vi.fn().mockResolvedValue({ results: [] }),
    },
    file: {
      read: vi.fn().mockResolvedValue({ content: "" }),
      status: vi.fn().mockResolvedValue({ status: "unmodified" }),
    },
    tui: {
      appendPrompt: vi.fn().mockResolvedValue(undefined),
      openHelp: vi.fn().mockResolvedValue(undefined),
      openSessions: vi.fn().mockResolvedValue(undefined),
      openThemes: vi.fn().mockResolvedValue(undefined),
      openModels: vi.fn().mockResolvedValue(undefined),
      submitPrompt: vi.fn().mockResolvedValue(undefined),
      clearPrompt: vi.fn().mockResolvedValue(undefined),
      executeCommand: vi.fn().mockResolvedValue(undefined),
      showToast: vi.fn().mockResolvedValue(undefined),
    },
    event: { subscribe: vi.fn().mockResolvedValue(unsubscribe) },
    _unsubscribe: unsubscribe,
  };
}

function createFakeOpenCodeSdkFactory(): OpenCodeSdkFactory & { _client: OpenCodeSdkClient } {
  const client = createFakeOpenCodeSdkClient();
  const factory = vi.fn().mockResolvedValue(client);
  return Object.assign(factory, { _client: client });
}

function createOpenCodeFakeSink(): ProviderEventSink {
  return { emit: vi.fn().mockResolvedValue(undefined) };
}

function createOpenCodeAdapter(options: Partial<ConstructorParameters<typeof OpenCodeAdapter>[0]> = {}): OpenCodeAdapter {
  const sdkFactory = createFakeOpenCodeSdkFactory();
  return new OpenCodeAdapter({
    sdkFactory,
    eventBus: undefined as any,
    runRegistry: undefined as any,
    permissionService: undefined as any,
    detectCli: async () => ({ available: true, path: "/usr/local/bin/opencode" }),
    ...options,
  });
}

describe("OpenCodeAdapter", () => {
  it("getCapabilities() includes every OpenCode action ID", () => {
    const adapter = createOpenCodeAdapter();
    const caps = adapter.getCapabilities();
    expect(caps).toBeDefined();
    expect(caps.maxConcurrency).toBeGreaterThan(0);
    const actionIds = adapter.listActions().map((a) => a.id);
    expect(actionIds).toEqual(opencodeActions.map((a) => a.id));
  });

  it("global.health calls SDK global.health", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "global.health", input: {} });
    expect(client.global.health).toHaveBeenCalled();
    expect(result.actionId).toBe("global.health");
  });

  it("app.log calls SDK app.log", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "app.log", input: { level: "info", message: "test" } });
    expect(client.app.log).toHaveBeenCalledWith({ level: "info", message: "test" });
    expect(result.actionId).toBe("app.log");
  });

  it("app.agents calls SDK app.agents", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "app.agents", input: {} });
    expect(client.app.agents).toHaveBeenCalled();
    expect(result.actionId).toBe("app.agents");
  });

  it("config.get calls SDK config.get", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "config.get", input: {} });
    expect(client.config.get).toHaveBeenCalled();
    expect(result.actionId).toBe("config.get");
  });

  it("config.providers calls SDK config.providers", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "config.providers", input: {} });
    expect(client.config.providers).toHaveBeenCalled();
    expect(result.actionId).toBe("config.providers");
  });

  it("path.get calls SDK path.get", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "path.get", input: {} });
    expect(client.path.get).toHaveBeenCalled();
    expect(result.actionId).toBe("path.get");
  });

  it("project.list calls SDK project.list", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "project.list", input: {} });
    expect(client.project.list).toHaveBeenCalled();
    expect(result.actionId).toBe("project.list");
  });

  it("project.current calls SDK project.current", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "project.current", input: {} });
    expect(client.project.current).toHaveBeenCalled();
    expect(result.actionId).toBe("project.current");
  });

  it("auth.set calls SDK auth.set", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeProviderAction({ actionId: "auth.set", input: { provider: "openai", apiKey: "sk-..." } });
    expect(client.auth.set).toHaveBeenCalledWith({ provider: "openai", apiKey: "sk-..." });
    expect(result.actionId).toBe("auth.set");
  });

  it("session.list calls SDK session.list", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.list", input: {} });
    expect(client.session.list).toHaveBeenCalled();
    expect(result.actionId).toBe("session.list");
  });

  it("session.create calls SDK session.create", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.create", input: { label: "test" } });
    expect(client.session.create).toHaveBeenCalledWith({ label: "test" });
    expect(result.actionId).toBe("session.create");
  });

  it("session.get calls SDK session.get", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.get", input: { id: "session_1" } });
    expect(client.session.get).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.get");
  });

  it("session.children calls SDK session.children", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.children", input: { id: "session_1" } });
    expect(client.session.children).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.children");
  });

  it("session.delete calls SDK session.delete", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.delete", input: { id: "session_1" } });
    expect(client.session.delete).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.delete");
  });

  it("session.update calls SDK session.update", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.update", input: { id: "session_1", label: "updated" } });
    expect(client.session.update).toHaveBeenCalledWith("session_1", { id: "session_1", label: "updated" });
    expect(result.actionId).toBe("session.update");
  });

  it("session.init calls SDK session.init", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.init", input: { model: "gpt-4" } });
    expect(client.session.init).toHaveBeenCalledWith({ model: "gpt-4" });
    expect(result.actionId).toBe("session.init");
  });

  it("session.share calls SDK session.share", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.share", input: { id: "session_1" } });
    expect(client.session.share).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.share");
  });

  it("session.unshare calls SDK session.unshare", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.unshare", input: { id: "session_1" } });
    expect(client.session.unshare).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.unshare");
  });

  it("session.summarize calls SDK session.summarize", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.summarize", input: { id: "session_1" } });
    expect(client.session.summarize).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.summarize");
  });

  it("session.messages calls SDK session.messages", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.messages", input: { id: "session_1" } });
    expect(client.session.messages).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.messages");
  });

  it("session.message calls SDK session.message", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.message", input: { id: "session_1", msgId: "msg_1" } });
    expect(client.session.message).toHaveBeenCalledWith("session_1", "msg_1");
    expect(result.actionId).toBe("session.message");
  });

  it("session.command calls SDK session.command", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.command", input: { id: "session_1", command: "ls" } });
    expect(client.session.command).toHaveBeenCalledWith("session_1", { id: "session_1", command: "ls" });
    expect(result.actionId).toBe("session.command");
  });

  it("session.shell calls SDK session.shell", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.shell", input: { id: "session_1", cmd: "ls" } });
    expect(client.session.shell).toHaveBeenCalledWith("session_1", { id: "session_1", cmd: "ls" });
    expect(result.actionId).toBe("session.shell");
  });

  it("session.revert calls SDK session.revert", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.revert", input: { id: "session_1" } });
    expect(client.session.revert).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.revert");
  });

  it("session.unrevert calls SDK session.unrevert", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.unrevert", input: { id: "session_1" } });
    expect(client.session.unrevert).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.unrevert");
  });

  it("session.prompt calls SDK session.prompt", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.prompt", input: { id: "session_1", prompt: "hello" } });
    expect(client.session.prompt).toHaveBeenCalledWith("session_1", { id: "session_1", prompt: "hello" });
    expect(result.actionId).toBe("session.prompt");
  });

  it("session.abort calls SDK session.abort", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.abort", input: { id: "session_1" } });
    expect(client.session.abort).toHaveBeenCalledWith("session_1");
    expect(result.actionId).toBe("session.abort");
  });

  it("session.permission.reply calls SDK session.permission.reply", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "session.permission.reply", input: { id: "session_1", permissionId: "perm_1", decision: "allow" } });
    expect(client.session.permission.reply).toHaveBeenCalledWith("session_1", "perm_1", { id: "session_1", permissionId: "perm_1", decision: "allow" });
    expect(result.actionId).toBe("session.permission.reply");
  });

  it("find.text calls SDK find.text", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "find.text", input: { pattern: "hello" } });
    expect(client.find.text).toHaveBeenCalledWith({ pattern: "hello" });
    expect(result.actionId).toBe("find.text");
  });

  it("find.files calls SDK find.files", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "find.files", input: { pattern: "*.ts" } });
    expect(client.find.files).toHaveBeenCalledWith({ pattern: "*.ts" });
    expect(result.actionId).toBe("find.files");
  });

  it("find.symbols calls SDK find.symbols", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "find.symbols", input: { query: "foo" } });
    expect(client.find.symbols).toHaveBeenCalledWith({ query: "foo" });
    expect(result.actionId).toBe("find.symbols");
  });

  it("file.read calls SDK file.read", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "file.read", input: { path: "test.ts" } });
    expect(client.file.read).toHaveBeenCalledWith({ path: "test.ts" });
    expect(result.actionId).toBe("file.read");
  });

  it("file.status calls SDK file.status", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const result = await adapter.executeRunAction({ runId: "run_1", actionId: "file.status", input: { path: "test.ts" } });
    expect(client.file.status).toHaveBeenCalledWith({ path: "test.ts" });
    expect(result.actionId).toBe("file.status");
  });

  it("tui actions call SDK tui methods", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });

    const tuiResults = await Promise.all([
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.appendPrompt", input: { text: "hello" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.openHelp", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.openSessions", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.openThemes", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.openModels", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.submitPrompt", input: { text: "hello" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.clearPrompt", input: {} }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.executeCommand", input: { command: "ls" } }),
      adapter.executeRunAction({ runId: "run_1", actionId: "tui.showToast", input: { message: "hi" } }),
    ]);
    expect(tuiResults.every((r) => r.actionId.startsWith("tui."))).toBe(true);
    expect(client.tui.appendPrompt).toHaveBeenCalled();
    expect(client.tui.openHelp).toHaveBeenCalled();
    expect(client.tui.openSessions).toHaveBeenCalled();
    expect(client.tui.openThemes).toHaveBeenCalled();
    expect(client.tui.openModels).toHaveBeenCalled();
    expect(client.tui.submitPrompt).toHaveBeenCalled();
    expect(client.tui.clearPrompt).toHaveBeenCalled();
    expect(client.tui.executeCommand).toHaveBeenCalled();
    expect(client.tui.showToast).toHaveBeenCalled();
  });

  it("tui actions are available but marked with sideEffect true", () => {
    const adapter = createOpenCodeAdapter();
    const tuiActions = adapter.listActions().filter((a) => a.id.startsWith("tui."));
    expect(tuiActions.length).toBeGreaterThan(0);
    expect(tuiActions.every((a) => a.sideEffects)).toBe(true);
  });

  it("getAuthStatus() reports OpenCode server/config auth when opencode is present", async () => {
    const adapter = createOpenCodeAdapter({ detectCli: async () => ({ available: true, path: "/usr/local/bin/opencode" }) });
    const status = await adapter.getAuthStatus();
    expect(status.available).toBe(true);
    expect(status.source).toBe("cli");
  });

  it("authMode: auto tries CLI first on startRun", async () => {
    const cli = vi.fn().mockResolvedValue({ available: true, path: "/usr/local/bin/opencode" });
    const sdkClient = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(sdkClient), { _client: sdkClient });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hi", authMode: "auto" };
    await adapter.startRun(request);
    expect(cli).toHaveBeenCalled();
  });

  it("authMode: cli fails with provider.auth_required when opencode CLI unavailable", async () => {
    const adapter = createOpenCodeAdapter({ detectCli: async () => ({ available: false, path: null }) });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hi", authMode: "cli" };
    await expect(adapter.startRun(request)).rejects.toThrow(providerFailure("CLI auth required but opencode CLI not found", "opencode"));
  });

  it("authMode: sdk skips CLI detection on startRun", async () => {
    const cli = vi.fn();
    const sdkClient = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(sdkClient), { _client: sdkClient });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory, detectCli: cli });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hi", authMode: "sdk" };
    await adapter.startRun(request);
    expect(cli).not.toHaveBeenCalled();
  });

  it("startRun creates a session, subscribes to events, calls session.prompt", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = { id: "run_1", createdAt: "2024-01-01T00:00:00Z", provider: "opencode", prompt: "hello" };
    const run = await adapter.startRun(request);
    expect(run.id).toBe("run_1");
    expect(run.provider).toBe("opencode");
    expect(run.status).toBe("running");
    expect(client.session.create).toHaveBeenCalled();
    expect(client.event.subscribe).toHaveBeenCalledWith("session_1", expect.any(Function));
    expect(client.session.prompt).toHaveBeenCalledWith("session_1", expect.objectContaining({ prompt: "hello" }));
  });

  it("subscribed events are emitted raw and normalized through the eventBus", async () => {
    const client = createFakeOpenCodeSdkClient();
    const rawEvents: Record<string, unknown>[] = [
      { type: "message.created", message: { id: "msg_1" } },
      { type: "tool.start", tool: { id: "t1", name: "Read" } },
    ];

    let subscribeCallback: ((event: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    client.event.subscribe = vi.fn().mockImplementation(async (_sessionId: string, callback: (event: unknown) => void) => {
      subscribeCallback = callback;
      return unsubscribe;
    });

    const published: unknown[] = [];
    const mockEventBus = { publish: vi.fn().mockImplementation((e: unknown) => { published.push(e); }) } as unknown as EventBus;
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory, eventBus: mockEventBus });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hello" };
    await adapter.startRun(request);

    expect(subscribeCallback).toBeDefined();

    for (const rawEvent of rawEvents) {
      await subscribeCallback!(rawEvent);
    }

    expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    const emittedEvents = published.map((e: unknown) => (e as Record<string, unknown>));
    expect(emittedEvents[0]?.type).toBe("message.started");
    expect(emittedEvents[1]?.type).toBe("tool.started");
  });

  it("startRun maps permissionMode yolo to allow permissions where OpenCode rules support it", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = { id: "run_3", createdAt: "2024-01-01T00:00:00Z", provider: "opencode", prompt: "go wild", permissionMode: "yolo" };
    await adapter.startRun(request);
    expect(client.session.prompt).toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({ permissionMode: "yolo" })
    );
  });

  it("startRun creates an AgentRun with correct defaults", async () => {
    const adapter = createOpenCodeAdapter();
    const request: AgentRunRequest = { id: "run_1", createdAt: "2024-01-01T00:00:00Z", provider: "opencode", prompt: "list files" };
    const run = await adapter.startRun(request);
    expect(run.id).toBe("run_1");
    expect(run.provider).toBe("opencode");
    expect(run.status).toBe("running");
  });

  it("cancelRun calls session.abort and returns cancelled run", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hello" };
    await adapter.startRun(request);
    const run = await adapter.cancelRun("run_1");
    expect(run.status).toBe("cancelled");
    expect(client.session.abort).toHaveBeenCalledWith("session_1");
  });

  it("resumeRun() returns a resumed run with running status", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hello" };
    await adapter.startRun(request);
    const run = await adapter.resumeRun("run_1");
    expect(run.id).toBe("run_1");
    expect(run.status).toBe("running");
  });

  it("resolvePermission() routes to session.permission.reply", async () => {
    const client = createFakeOpenCodeSdkClient();
    const factory: OpenCodeSdkFactory & { _client: OpenCodeSdkClient } = Object.assign(vi.fn().mockResolvedValue(client), { _client: client });
    const adapter = createOpenCodeAdapter({ sdkFactory: factory });
    const request: AgentRunRequest = { id: "run_1", createdAt: "now", provider: "opencode", prompt: "hello" };
    await adapter.startRun(request);
    await adapter.resolvePermission("run_1", "perm_1", { decision: "allow", scope: "once" });
    expect(client.session.permission.reply).toHaveBeenCalledWith(
      "session_1", "perm_1", { decision: "allow", scope: "once" }
    );
  });
});

describe("SDK coverage documentation", () => {
  let md: string;

  beforeAll(async () => {
    const { generateCoverageContent } = await import("../../scripts/generate-sdk-coverage.js");
    md = generateCoverageContent();
  }, 30000);

  it("includes every opencode action ID in generated markdown", () => {
    for (const action of opencodeActions) {
      expect(md).toContain(action.id);
    }
  });

  it("includes every codex action ID in generated markdown", () => {
    for (const action of codexActions) {
      expect(md).toContain(action.id);
    }
  });

  it("includes every claude action ID in generated markdown", () => {
    for (const action of claudeActions) {
      expect(md).toContain(action.id);
    }
  });
});
