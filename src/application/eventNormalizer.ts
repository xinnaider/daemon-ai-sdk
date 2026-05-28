import type { ProviderId, DaemonEvent } from "../domain/events.js";

export interface NormalizeInput {
  provider: ProviderId;
  raw: unknown;
  runId: string;
  sequence: number;
}

export type NormalizerFn = (input: NormalizeInput) => DaemonEvent[];

const normalizers = new Map<string, NormalizerFn>();

export function registerNormalizer(provider: string, fn: NormalizerFn): void {
  normalizers.set(provider, fn);
}

export function normalizeRawEvent(input: NormalizeInput): DaemonEvent[] {
  const fn = normalizers.get(input.provider);
  if (fn) {
    return fn(input);
  }
  return [
    {
      id: `evt_${input.sequence}`,
      runId: input.runId,
      provider: input.provider,
      type: "unknown" as DaemonEvent["type"],
      createdAt: new Date().toISOString(),
      sequence: input.sequence,
      data: { raw: input.raw },
    },
  ];
}
