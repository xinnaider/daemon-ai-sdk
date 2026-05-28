import type { AgentRun } from "../domain/runs.js";

export interface ProviderHandle {
  provider: string;
  native: Record<string, unknown>;
}

export class RunRegistry {
  private runs = new Map<string, AgentRun>();
  private handles = new Map<string, ProviderHandle>();

  addRun(run: AgentRun): void {
    this.runs.set(run.id, run);
  }

  getRun(runId: string): AgentRun | undefined {
    return this.runs.get(runId);
  }

  listRuns(): AgentRun[] {
    return Array.from(this.runs.values());
  }

  updateRun(runId: string, partial: Partial<AgentRun>): void {
    const existing = this.runs.get(runId);
    if (existing) {
      this.runs.set(runId, { ...existing, ...partial });
    }
  }

  setHandle(runId: string, handle: ProviderHandle): void {
    this.handles.set(runId, handle);
  }

  getHandle(runId: string): ProviderHandle | undefined {
    return this.handles.get(runId);
  }

  removeHandle(runId: string): void {
    this.handles.delete(runId);
  }
}
