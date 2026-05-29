import type { AgentProvider } from "../../../ports/agentProvider.js";
import type { ProviderCapabilities, SdkActionDescriptor, SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../../../domain/providers.js";
import type { ProviderAuthStatus, AuthMode } from "../../../domain/auth.js";
import type { AgentRun, AgentRunRequest } from "../../../domain/runs.js";
import type { PermissionResolution } from "../../../domain/permissions.js";
import type { DaemonEvent, ProviderEventSink } from "../../../domain/events.js";
import type { EventBus } from "../../../application/eventBus.js";
import type { RunRegistry } from "../../../application/runRegistry.js";
import type { PermissionService } from "../../../application/permissionService.js";
import { providerFailure } from "../../../domain/errors.js";
import { claudeActions } from "./actions.js";
import type { ClaudeSdkFacade, QueryInstance, QueryOptions } from "./claudeClient.js";
import { detectCli } from "../../../infrastructure/cli.js";
import { nowIso } from "../../../infrastructure/time.js";
import { createId } from "../../../infrastructure/ids.js";
import { ensureClaudeSdkLoaded } from "./claudeClient.js";
import { normalizeClaudeMessage } from "./claudeNormalizer.js";

export interface ClaudeAdapterOptions {
  facade: ClaudeSdkFacade;
  eventBus?: EventBus;
  runRegistry?: RunRegistry;
  permissionService?: PermissionService;
  detectCli?: (binary: string) => Promise<{ available: boolean; path: string | null }>;
}

export class ClaudeAdapter implements AgentProvider {
  private options: ClaudeAdapterOptions;
  private activeQueries = new Map<string, { query: QueryInstance; abort: AbortController; facade: ClaudeSdkFacade }>();

  constructor(options: ClaudeAdapterOptions) {
    this.options = options;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxConcurrency: 1,
      supportsStreaming: true,
      supportsSdkActions: true,
    };
  }

  listActions(): SdkActionDescriptor[] {
    return claudeActions;
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    const detect = this.options.detectCli ?? detectCli;
    const result = await detect("claude");
    return {
      mode: "auto",
      available: result.available,
      source: result.available ? "cli" : null,
      requiresApiKey: !result.available,
    };
  }

  async executeProviderAction(request: ProviderSdkActionRequest): Promise<SdkActionResult> {
    const action = claudeActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown provider action: ${request.actionId}`, "claude");
    }
    if (action.scope !== "provider") {
      throw providerFailure(`Action '${request.actionId}' is not a provider-scope action`, "claude");
    }

    const facade = this.getFacade();
    const start = Date.now();
    let output: unknown;

    switch (request.actionId) {
      case "tool.create": {
        output = await facade.tool.create(request.input);
        break;
      }
      case "mcp.createSdkMcpServer": {
        output = await facade.createSdkMcpServer(request.input);
        break;
      }
      case "sessions.list": {
        output = await facade.listSessions(request.input);
        break;
      }
      case "sessions.messages": {
        output = await facade.getSessionMessages(request.input);
        break;
      }
      case "sessions.info": {
        output = await facade.getSessionInfo(request.input);
        break;
      }
      case "sessions.rename": {
        output = await facade.renameSession(request.input);
        break;
      }
      case "sessions.tag": {
        output = await facade.tagSession(request.input);
        break;
      }
      default:
        throw providerFailure(`Unimplemented provider action: ${request.actionId}`, "claude");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async executeRunAction(request: RunSdkActionRequest): Promise<SdkActionResult> {
    const action = claudeActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown run action: ${request.actionId}`, "claude");
    }
    if (action.scope !== "run") {
      throw providerFailure(`Action '${request.actionId}' is not a run-scope action`, "claude");
    }

    const entry = this.activeQueries.get(request.runId);
    if (!entry) {
      throw providerFailure(`No active query for run: ${request.runId}`, "claude");
    }

    const start = Date.now();
    const { query } = entry;
    let output: unknown;

    switch (request.actionId) {
      case "query.run": {
        const { sink, ...runInput } = request.input as Record<string, unknown> & { sink?: ProviderEventSink };
        const newQuery = entry.facade.query({ prompt: runInput.prompt as string ?? "" });
        this.activeQueries.set(request.runId, { ...entry, query: newQuery });
        output = { queryStarted: true };
        break;
      }
      case "query.interrupt":
        await query.interrupt();
        output = { interrupted: true };
        break;
      case "query.close":
        await query.close();
        this.activeQueries.delete(request.runId);
        output = { closed: true };
        break;
      case "query.initializationResult":
        output = await query.initializationResult;
        break;
      case "query.supportedCommands":
        output = await query.supportedCommands;
        break;
      case "query.supportedModels":
        output = await query.supportedModels;
        break;
      case "query.supportedAgents":
        output = await query.supportedAgents;
        break;
      case "query.accountInfo":
        output = await query.accountInfo;
        break;
      case "query.rewindFiles":
        await query.rewindFiles();
        output = { rewound: true };
        break;
      case "query.setPermissionMode": {
        const mode = request.input.mode as string;
        await query.setPermissionMode(mode);
        output = { mode };
        break;
      }
      case "query.setModel": {
        const model = request.input.model as string;
        await query.setModel(model);
        output = { model };
        break;
      }
      case "query.setMaxThinkingTokens": {
        const tokens = request.input.tokens as number;
        await query.setMaxThinkingTokens(tokens);
        output = { tokens };
        break;
      }
      case "query.mcpServerStatus":
        output = await query.mcpServerStatus;
        break;
      case "query.reconnectMcpServer": {
        const name = request.input.name as string;
        await query.reconnectMcpServer(name);
        output = { name };
        break;
      }
      case "query.toggleMcpServer": {
        const name = request.input.name as string;
        const enabled = request.input.enabled as boolean;
        await query.toggleMcpServer(name, enabled);
        output = { name, enabled };
        break;
      }
      case "query.setMcpServers": {
        const servers = request.input.servers as unknown[];
        await query.setMcpServers(servers);
        output = { servers: servers.length };
        break;
      }
      case "query.streamInput": {
        const input = request.input.input as string;
        await query.streamInput(input);
        output = { streamed: true };
        break;
      }
      case "query.stopTask":
        await query.stopTask();
        output = { stopped: true };
        break;
      default:
        throw providerFailure(`Unimplemented run action: ${request.actionId}`, "claude");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async startRun(request: AgentRunRequest): Promise<AgentRun> {
    const authMode = request.authMode ?? "auto";

    if (authMode === "auto" || authMode === "cli") {
      const detect = this.options.detectCli ?? detectCli;
      const cliStatus = await detect("claude");
      if (authMode === "cli" && !cliStatus.available) {
        throw providerFailure("CLI auth required but claude CLI not found", "claude");
      }
    }

    await ensureClaudeSdkLoaded();
    const facade = this.getFacade();
    const controller = new AbortController();
    const permissionMode = request.permissionMode ?? "normal";

    let canUseTool: QueryOptions["canUseTool"];

    if (permissionMode === "normal" && this.options.permissionService) {
      canUseTool = async (toolName: string, toolInput: unknown) => {
        const permissionId = createId("perm");
        const toolRecord =
          typeof toolInput === "object" && toolInput !== null
            ? (toolInput as Record<string, unknown>)
            : { value: toolInput };
        const pending = this.options.permissionService!.createPending({
          permissionId,
          runId: request.id,
          provider: "claude",
          toolName,
          toolInput: toolRecord,
          createdAt: nowIso(),
        });

        if (this.options.eventBus) {
          this.options.eventBus.publish({
            id: createId("evt"),
            runId: request.id,
            provider: "claude",
            type: "permission.requested" as DaemonEvent["type"],
            createdAt: nowIso(),
            sequence: 0,
            data: { permissionId, toolName, toolInput: toolRecord },
          });
        }

        const resolution = await pending.promise;
        return { decision: resolution.decision, scope: resolution.scope };
      };
    }

    const queryOptions: QueryOptions = {
      prompt: request.prompt,
      signal: controller.signal,
      permissionMode,
      includePartialMessages: true,
      ...(canUseTool ? { canUseTool } : {}),
    };

    if (request.cwd) queryOptions.cwd = request.cwd;
    if (request.model) queryOptions.model = request.model;
    if (request.maxTurns !== undefined) queryOptions.maxTurns = request.maxTurns;
    if (request.mcpServers) queryOptions.mcpServers = request.mcpServers;
    if (request.agents) queryOptions.agents = request.agents;

    const query = facade.query(queryOptions);

    this.activeQueries.set(request.id, { query, abort: controller, facade });

    if (this.options.runRegistry) {
      this.options.runRegistry.addRun({
        id: request.id,
        createdAt: request.createdAt,
        updatedAt: nowIso(),
        provider: "claude",
        prompt: request.prompt,
        status: "running",
        authMode,
        permissionMode,
      });
    }

    return {
      id: request.id,
      createdAt: request.createdAt,
      updatedAt: nowIso(),
      provider: "claude",
      prompt: request.prompt,
      status: "running",
      authMode,
      permissionMode,
    };
  }

  async resumeRun(runId: string): Promise<AgentRun> {
    return {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      provider: "claude",
      prompt: "",
      status: "running",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const entry = this.activeQueries.get(runId);
    if (entry) {
      await entry.query.close().catch(() => {});
      entry.abort.abort();
      this.activeQueries.delete(runId);
    }
    return {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      provider: "claude",
      prompt: "",
      status: "cancelled",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async resolvePermission(_runId: string, _permissionId: string, _resolution: PermissionResolution): Promise<void> {
    return;
  }

  private getFacade(): ClaudeSdkFacade {
    return this.options.facade;
  }
}
