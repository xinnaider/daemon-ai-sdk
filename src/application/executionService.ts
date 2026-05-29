import type { AgentRun, AgentRunRequest, RunStatus } from "../domain/runs.js";
import { createRun } from "../domain/runs.js";
import type { ProviderId, DaemonEvent } from "../domain/events.js";
import type { PermissionResolution } from "../domain/permissions.js";
import type { SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../domain/providers.js";
import type { ProviderRegistry } from "../adapters/providers/common/providerRegistry.js";
import type { RunRegistry } from "./runRegistry.js";
import type { PermissionService } from "./permissionService.js";
import type { EventBus } from "./eventBus.js";
import type { EventLogger } from "../ports/eventLogger.js";
import type { LogEventKind } from "../domain/logging.js";

export interface ProviderResumeInput {
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export type ExecutionServiceDeps = {
  providers: ProviderRegistry;
  runs: RunRegistry;
  permissions: PermissionService;
  events: EventBus;
  logger: EventLogger;
  createId: (prefix: string) => string;
  now: () => string;
};

export class ExecutionService {
  private deps: ExecutionServiceDeps;

  constructor(deps: ExecutionServiceDeps) {
    this.deps = deps;
  }

  async startRun(request: AgentRunRequest): Promise<AgentRun> {
    const normalizedRequest: AgentRunRequest = {
      ...request,
      id: request.id || this.deps.createId("run"),
      createdAt: request.createdAt || this.deps.now(),
    };

    await this.deps.logger.log({
      id: this.deps.createId("log"),
      createdAt: this.deps.now(),
      level: "info",
      kind: "run.start" as LogEventKind,
      message: "Starting run",
      data: { provider: normalizedRequest.provider, prompt: normalizedRequest.prompt },
    });

    const run = createRun(normalizedRequest);
    this.deps.runs.addRun(run);

    const createdEvent: DaemonEvent = {
      id: this.deps.createId("evt"),
      runId: run.id,
      provider: normalizedRequest.provider as ProviderId,
      type: "run.created" as DaemonEvent["type"],
      createdAt: this.deps.now(),
      sequence: 0,
      data: { runId: run.id, provider: normalizedRequest.provider },
    };
    this.deps.events.publish(createdEvent);

    const provider = this.deps.providers.get(normalizedRequest.provider);

    const result = await provider.startRun(normalizedRequest);

    this.deps.runs.setHandle(run.id, { provider: normalizedRequest.provider, native: {} });

    const terminalStatuses: RunStatus[] = ["completed", "failed", "cancelled"];
    if (terminalStatuses.includes(result.status)) {
      this.deps.runs.updateRun(run.id, { status: result.status, updatedAt: this.deps.now() });
    }

    return result;
  }

  async resumeRun(runId: string, _input: ProviderResumeInput): Promise<AgentRun> {
    const run = this.deps.runs.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const provider = this.deps.providers.get(run.provider);
    const result = await provider.resumeRun(runId);

    return result;
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const run = this.deps.runs.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const provider = this.deps.providers.get(run.provider);
    const result = await provider.cancelRun(runId);

    return result;
  }

  async resolvePermission(runId: string, permissionId: string, resolution: PermissionResolution): Promise<void> {
    this.deps.permissions.resolve(runId, permissionId, resolution);

    const run = this.deps.runs.getRun(runId);
    if (run) {
      const provider = this.deps.providers.get(run.provider);
      await provider.resolvePermission(runId, permissionId, resolution);
    }
  }

  async executeProviderAction(provider: string, request: ProviderSdkActionRequest): Promise<SdkActionResult> {
    return this.deps.providers.executeProviderAction(provider, request);
  }

  async executeRunAction(runId: string, request: RunSdkActionRequest): Promise<SdkActionResult> {
    return this.deps.providers.executeRunAction(runId, request);
  }
}
