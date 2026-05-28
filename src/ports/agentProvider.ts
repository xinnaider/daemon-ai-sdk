import type { ProviderCapabilities, SdkActionDescriptor, SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../domain/providers.js";
import type { ProviderAuthStatus, AuthMode } from "../domain/auth.js";
import type { AgentRun, AgentRunRequest } from "../domain/runs.js";
import type { PermissionResolution } from "../domain/permissions.js";

export interface AgentProvider {
  getCapabilities(): ProviderCapabilities;
  getAuthStatus(): Promise<ProviderAuthStatus>;
  listActions(): SdkActionDescriptor[];
  executeProviderAction(request: ProviderSdkActionRequest): Promise<SdkActionResult>;
  executeRunAction(request: RunSdkActionRequest): Promise<SdkActionResult>;
  startRun(request: AgentRunRequest): Promise<AgentRun>;
  resumeRun(runId: string): Promise<AgentRun>;
  cancelRun(runId: string): Promise<AgentRun>;
  resolvePermission(runId: string, permissionId: string, resolution: PermissionResolution): Promise<void>;
}
