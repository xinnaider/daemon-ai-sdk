import type { AgentProvider } from "../../../ports/agentProvider.js";
import type { ProviderCapabilities, SdkActionDescriptor, SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../../../domain/providers.js";
import type { ProviderAuthStatus, AuthMode } from "../../../domain/auth.js";
import type { AgentRun, AgentRunRequest } from "../../../domain/runs.js";
import type { PermissionResolution } from "../../../domain/permissions.js";
import type { ProviderEventSink, ProviderRawEvent } from "../../../domain/events.js";
import type { EventBus } from "../../../application/eventBus.js";
import type { RunRegistry } from "../../../application/runRegistry.js";
import type { PermissionService } from "../../../application/permissionService.js";
import { providerFailure } from "../../../domain/errors.js";
import { codexActions } from "./actions.js";
import type { CodexSdkFactory, CodexSdkClient } from "./codexClient.js";
import { detectCli } from "../../../infrastructure/cli.js";
import { createId } from "../../../infrastructure/ids.js";
import { nowIso } from "../../../infrastructure/time.js";
import { normalizeCodexEvent } from "./codexNormalizer.js";

export interface CodexAdapterOptions {
  sdkFactory: CodexSdkFactory;
  eventBus?: EventBus;
  runRegistry?: RunRegistry;
  permissionService?: PermissionService;
  detectCli?: (binary: string) => Promise<{ available: boolean; path: string | null }>;
}

export class CodexAdapter implements AgentProvider {
  private options: CodexAdapterOptions;
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(options: CodexAdapterOptions) {
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
    return codexActions;
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    const detect = this.options.detectCli ?? detectCli;
    const result = await detect("codex");
    return {
      mode: "auto",
      available: result.available,
      source: result.available ? "cli" : null,
      requiresApiKey: !result.available,
    };
  }

  async executeProviderAction(request: ProviderSdkActionRequest): Promise<SdkActionResult> {
    const action = codexActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown provider action: ${request.actionId}`, "codex");
    }
    if (action.scope !== "provider") {
      throw providerFailure(`Action '${request.actionId}' is not a provider-scope action`, "codex");
    }

    const sdk = this.getSdkClient();
    const start = Date.now();
    let output: unknown;

    switch (request.actionId) {
      case "thread.start":
        output = await sdk.startThread(request.input);
        break;
      default:
        throw providerFailure(`Unimplemented provider action: ${request.actionId}`, "codex");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async executeRunAction(request: RunSdkActionRequest): Promise<SdkActionResult> {
    const action = codexActions.find((a) => a.id === request.actionId);
    if (!action) {
      throw providerFailure(`Unknown run action: ${request.actionId}`, "codex");
    }
    if (action.scope !== "run") {
      throw providerFailure(`Action '${request.actionId}' is not a run-scope action`, "codex");
    }

    const sdk = this.getSdkClient();
    const start = Date.now();
    let output: unknown;

    switch (request.actionId) {
      case "thread.resume": {
        output = await sdk.resumeThread(request.input);
        break;
      }
      case "thread.run": {
        const result = sdk.run(request.input);
        if (isAsyncGenerator(result)) {
          const events: Record<string, unknown>[] = [];
          for await (const evt of result) {
            events.push(evt);
          }
          output = { events };
        } else {
          output = await result;
        }
        break;
      }
      case "thread.runStreamed": {
        const { sink, ...runInput } = request.input as Record<string, unknown> & { sink?: ProviderEventSink };
        const result = sdk.run(runInput);
        if (isAsyncGenerator(result)) {
          const events: Record<string, unknown>[] = [];
          for await (const evt of result) {
            events.push(evt);
            if (sink) {
              const daemonEvents = normalizeCodexEvent({
                provider: "codex",
                raw: evt,
                runId: request.runId,
                sequence: events.length,
              });
              for (const de of daemonEvents) {
                await sink.emit(de);
              }
            }
          }
          output = { events };
        } else {
          output = await result;
        }
        break;
      }
      case "turn.cancel": {
        const controller = this.activeAbortControllers.get(request.runId);
        if (controller) {
          controller.abort();
          this.activeAbortControllers.delete(request.runId);
        }
        output = { cancelled: true };
        break;
      }
      default:
        throw providerFailure(`Unimplemented run action: ${request.actionId}`, "codex");
    }

    return { actionId: request.actionId, output, durationMs: Date.now() - start };
  }

  async startRun(request: AgentRunRequest): Promise<AgentRun> {
    const authMode = request.authMode ?? "auto";
    const status = await this.getAuthStatus();

    if (authMode === "cli" && !status.available) {
      throw providerFailure("CLI auth required but codex CLI not found", "codex");
    }

    const sdk = this.getSdkClient();
    const controller = new AbortController();
    this.activeAbortControllers.set(request.id, controller);

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      signal: controller.signal,
    };

    const permissionMode = request.permissionMode ?? "normal";
    if (permissionMode === "yolo") {
      input.approvalPolicy = "never";
      input.sandboxMode = "danger-full-access";
    } else {
      input.approvalPolicy = "on-request";
    }

    await sdk.startThread(input);

    if (this.options.runRegistry) {
      this.options.runRegistry.addRun({
        id: request.id,
        createdAt: request.createdAt,
        updatedAt: nowIso(),
        provider: "codex",
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
      provider: "codex",
      prompt: request.prompt,
      status: "running",
      authMode,
      permissionMode,
    };
  }

  async resumeRun(runId: string): Promise<AgentRun> {
    const sdk = this.getSdkClient();
    const result = await sdk.resumeThread({ threadId: runId });

    const threadData = result as Record<string, unknown>;
    const runResult = (threadData.run ?? {}) as Record<string, unknown>;

    return {
      id: runId,
      createdAt: (runResult.createdAt as string) ?? nowIso(),
      updatedAt: nowIso(),
      provider: "codex",
      prompt: (runResult.prompt as string) ?? "",
      status: "running",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const controller = this.activeAbortControllers.get(runId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(runId);
    }
    return {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      provider: "codex",
      prompt: "",
      status: "cancelled",
      authMode: "auto",
      permissionMode: "normal",
    };
  }

  async resolvePermission(_runId: string, _permissionId: string, _resolution: PermissionResolution): Promise<void> {
    return;
  }

  private getSdkClient(): CodexSdkClient {
    return this.options.sdkFactory({});
  }
}

function isAsyncGenerator(value: unknown): value is AsyncGenerator<unknown, void, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in (value as object)
  );
}
