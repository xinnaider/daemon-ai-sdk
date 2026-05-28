import { describe, expect, it } from "vitest";
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
