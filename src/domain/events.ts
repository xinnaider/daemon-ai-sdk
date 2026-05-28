export type ProviderId = "opencode" | "codex" | "claude";

export type DaemonEventType = string & { __brand: "DaemonEventType" };

export interface DaemonEvent {
  id: string;
  runId: string;
  provider: ProviderId;
  type: DaemonEventType;
  createdAt: string;
  sequence: number;
  data: Record<string, unknown>;
}

export function createDaemonEvent(params: DaemonEvent): DaemonEvent {
  if (!params.id || !params.runId) {
    throw new Error("DaemonEvent requires id and runId");
  }
  return { ...params };
}

export type ProviderRawEvent<T = unknown> = {
  provider: ProviderId;
  raw: T;
};

export interface ProviderEventSink {
  emit(event: DaemonEvent): Promise<void>;
}
