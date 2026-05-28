import type { AgentProvider } from "../../../ports/agentProvider.js";
import type { ProviderCapabilities, SdkActionDescriptor, SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../../../domain/providers.js";
import type { ProviderAuthStatus, AuthMode } from "../../../domain/auth.js";
import type { AgentRun, AgentRunRequest } from "../../../domain/runs.js";
import type { PermissionResolution } from "../../../domain/permissions.js";
import type { ProviderEventSink } from "../../../domain/events.js";
import type { EventBus } from "../../../application/eventBus.js";
import type { RunRegistry } from "../../../application/runRegistry.js";
import type { PermissionService } from "../../../application/permissionService.js";
import { providerFailure } from "../../../domain/errors.js";
import { opencodeActions } from "./actions.js";
import type { OpenCodeSdkFactory, OpenCodeSdkClient } from "./opencodeClient.js";
import { detectCli } from "../../../infrastructure/cli.js";
import { createId } from "../../../infrastructure/ids.js";
import { nowIso } from "../../../infrastructure/time.js";
import { normalizeOpenCodeEvent } from "./opencodeNormalizer.js";

export interface OpenCodeAdapterOptions {
  sdkFactory: OpenCodeSdkFactory;
  eventBus?: EventBus;
  runRegistry?: RunRegistry;
  permissionService?: PermissionService;
  detectCli?: (binary: string) => Promise<{ available: boolean; path: string | null }>;
}

export class OpenCodeAdapter implements AgentProvider {
  private options: OpenCodeAdapterOptions;
  private activeSessions = new Map<string, { sessionId: string; client: OpenCodeSdkClient; unsubscribe: () => void }>();

  constructor(options: OpenCodeAdapterOptions) {
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
    return opencodeActions;
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    const detect = this.options.detectCli ?? detectCli;
    const result = await detect("opencode");
    let source: string | null = null;
    if (result.available) {
      source = "cli";
    }
    return {
      mode: "auto",
      available: result.available || !!process.env.OPENCODE_DAEMON_REAL_TEST,
      source: result.available ? "cli" : (process.env.OPENCODE_DAEMON_REAL_TEST ? "env" : null),
      requiresApiKey: !result.available && !process.env.OPENCODE_DAEMON_REAL_TEST,
    };
  }

  async executeProviderAction(request: ProviderSdkActionRequest): Promise<SdkActionResult> {
    const action = opencodeActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown provider action: ${request.actionId}`, "opencode");
    }
    if (action.scope !== "provider") {
      throw providerFailure(`Action '${request.actionId}' is not a provider-scope action`, "opencode");
    }

    const sdk = await this.getSdkClient();
    const start = Date.now();
    let output: unknown;

    switch (request.actionId) {
      case "global.health":
        output = await sdk.global.health();
        break;
      case "app.log":
        output = await sdk.app.log(request.input);
        break;
      case "app.agents":
        output = await sdk.app.agents();
        break;
      case "config.get":
        output = await sdk.config.get();
        break;
      case "config.providers":
        output = await sdk.config.providers();
        break;
      case "path.get":
        output = await sdk.path.get();
        break;
      case "project.list":
        output = await sdk.project.list();
        break;
      case "project.current":
        output = await sdk.project.current();
        break;
      case "auth.set":
        output = await sdk.auth.set(request.input);
        break;
      default:
        throw providerFailure(`Unimplemented provider action: ${request.actionId}`, "opencode");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async executeRunAction(request: RunSdkActionRequest): Promise<SdkActionResult> {
    const action = opencodeActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown run action: ${request.actionId}`, "opencode");
    }
    if (action.scope !== "run") {
      throw providerFailure(`Action '${request.actionId}' is not a run-scope action`, "opencode");
    }

    const sdk = await this.getSdkClient();
    const start = Date.now();
    let output: unknown;

    switch (request.actionId) {
      case "session.list":
        output = await sdk.session.list();
        break;
      case "session.create":
        output = await sdk.session.create(request.input);
        break;
      case "session.get": {
        const id = request.input.id as string;
        output = await sdk.session.get(id);
        break;
      }
      case "session.children": {
        const id = request.input.id as string;
        output = await sdk.session.children(id);
        break;
      }
      case "session.delete": {
        const id = request.input.id as string;
        output = await sdk.session.delete(id);
        break;
      }
      case "session.update": {
        const id = request.input.id as string;
        output = await sdk.session.update(id, request.input);
        break;
      }
      case "session.init":
        output = await sdk.session.init(request.input);
        break;
      case "session.share": {
        const id = request.input.id as string;
        output = await sdk.session.share(id);
        break;
      }
      case "session.unshare": {
        const id = request.input.id as string;
        output = await sdk.session.unshare(id);
        break;
      }
      case "session.summarize": {
        const id = request.input.id as string;
        output = await sdk.session.summarize(id);
        break;
      }
      case "session.messages": {
        const id = request.input.id as string;
        output = await sdk.session.messages(id);
        break;
      }
      case "session.message": {
        const id = request.input.id as string;
        const msgId = request.input.msgId as string;
        output = await sdk.session.message(id, msgId);
        break;
      }
      case "session.command": {
        const id = request.input.id as string;
        output = await sdk.session.command(id, request.input);
        break;
      }
      case "session.shell": {
        const id = request.input.id as string;
        output = await sdk.session.shell(id, request.input);
        break;
      }
      case "session.revert": {
        const id = request.input.id as string;
        output = await sdk.session.revert(id);
        break;
      }
      case "session.unrevert": {
        const id = request.input.id as string;
        output = await sdk.session.unrevert(id);
        break;
      }
      case "session.prompt": {
        const id = request.input.id as string;
        output = await sdk.session.prompt(id, request.input);
        break;
      }
      case "session.abort": {
        const id = request.input.id as string;
        output = await sdk.session.abort(id);
        break;
      }
      case "session.permission.reply": {
        const id = request.input.id as string;
        const permissionId = request.input.permissionId as string;
        output = await sdk.session.permission.reply(id, permissionId, request.input);
        break;
      }
      case "find.text":
        output = await sdk.find.text(request.input);
        break;
      case "find.files":
        output = await sdk.find.files(request.input);
        break;
      case "find.symbols":
        output = await sdk.find.symbols(request.input);
        break;
      case "file.read":
        output = await sdk.file.read(request.input);
        break;
      case "file.status":
        output = await sdk.file.status(request.input);
        break;
      case "tui.appendPrompt":
        output = await sdk.tui.appendPrompt(request.input);
        break;
      case "tui.openHelp":
        output = await sdk.tui.openHelp();
        break;
      case "tui.openSessions":
        output = await sdk.tui.openSessions();
        break;
      case "tui.openThemes":
        output = await sdk.tui.openThemes();
        break;
      case "tui.openModels":
        output = await sdk.tui.openModels();
        break;
      case "tui.submitPrompt":
        output = await sdk.tui.submitPrompt(request.input);
        break;
      case "tui.clearPrompt":
        output = await sdk.tui.clearPrompt();
        break;
      case "tui.executeCommand":
        output = await sdk.tui.executeCommand(request.input);
        break;
      case "tui.showToast":
        output = await sdk.tui.showToast(request.input);
        break;
      default:
        throw providerFailure(`Unimplemented run action: ${request.actionId}`, "opencode");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async startRun(request: AgentRunRequest): Promise<AgentRun> {
    const authMode = request.authMode ?? "auto";

    if (authMode === "auto" || authMode === "cli") {
      const detect = this.options.detectCli ?? detectCli;
      const cliStatus = await detect("opencode");
      if (authMode === "cli" && !cliStatus.available) {
        throw providerFailure("CLI auth required but opencode CLI not found", "opencode");
      }
    }

    const sdk = await this.getSdkClient();
    const permissionMode = request.permissionMode ?? "normal";

    const sessionResult = await sdk.session.create() as Record<string, unknown>;
    const sessionId = sessionResult.id as string;

    let sequence = 0;
    const unsubscribe = await sdk.event.subscribe(sessionId, (rawEvent: unknown) => {
      sequence++;
      const daemonEvents = normalizeOpenCodeEvent({
        provider: "opencode",
        raw: rawEvent,
        runId: request.id,
        sequence,
      });
      if (this.options.eventBus) {
        for (const de of daemonEvents) {
          this.options.eventBus.publish(de);
        }
      }
    });

    this.activeSessions.set(request.id, { sessionId, client: sdk, unsubscribe });

    const promptInput: Record<string, unknown> = {
      prompt: request.prompt,
      permissionMode,
    };

    sdk.session.prompt(sessionId, promptInput).catch(() => {});

    if (this.options.runRegistry) {
      this.options.runRegistry.addRun({
        id: request.id,
        createdAt: request.createdAt,
        updatedAt: nowIso(),
        provider: "opencode",
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
      provider: "opencode",
      prompt: request.prompt,
      status: "running",
      authMode,
      permissionMode,
    };
  }

  async resumeRun(runId: string): Promise<AgentRun> {
    const entry = this.activeSessions.get(runId);
    if (!entry) {
      throw providerFailure(`No active session for run: ${runId}`, "opencode");
    }
    return {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      provider: "opencode",
      prompt: "",
      status: "running",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const entry = this.activeSessions.get(runId);
    if (entry) {
      entry.unsubscribe();
      await entry.client.session.abort(entry.sessionId).catch(() => {});
      this.activeSessions.delete(runId);
    }
    return {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      provider: "opencode",
      prompt: "",
      status: "cancelled",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async resolvePermission(runId: string, permissionId: string, resolution: PermissionResolution): Promise<void> {
    const entry = this.activeSessions.get(runId);
    if (entry) {
      await entry.client.session.permission.reply(entry.sessionId, permissionId, resolution);
    }
  }

  private async getSdkClient(): Promise<OpenCodeSdkClient> {
    const config: Record<string, unknown> = {};
    if (process.env.OPENCODE_API_KEY) config.apiKey = process.env.OPENCODE_API_KEY;
    if (process.env.OPENCODE_DAEMON_REAL_TEST) config.testMode = true;
    return this.options.sdkFactory(config);
  }
}
