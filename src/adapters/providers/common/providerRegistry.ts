import type { AgentProvider } from "../../../ports/agentProvider.js";
import type { SdkActionDescriptor, SdkActionResult, ProviderSdkActionRequest, RunSdkActionRequest } from "../../../domain/providers.js";
import type { ProviderAuthStatus } from "../../../domain/auth.js";
import { DaemonError } from "../../../domain/errors.js";

export class ProviderRegistry {
  private providers = new Map<string, AgentProvider>();

  register(id: string, provider: AgentProvider): void {
    if (this.providers.has(id)) {
      throw new DaemonError(`Provider '${id}' is already registered`, "provider.duplicate", 409);
    }
    this.providers.set(id, provider);
  }

  get(id: string): AgentProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new DaemonError(`Unknown provider '${id}'`, "provider.not_found", 404);
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  async authStatusFor(id: string): Promise<ProviderAuthStatus> {
    return this.get(id).getAuthStatus();
  }

  actionsFor(id: string): SdkActionDescriptor[] {
    return this.get(id).listActions();
  }

  async executeProviderAction(id: string, request: ProviderSdkActionRequest): Promise<SdkActionResult> {
    return this.get(id).executeProviderAction(request);
  }

  async executeRunAction(id: string, request: RunSdkActionRequest): Promise<SdkActionResult> {
    return this.get(id).executeRunAction(request);
  }
}
