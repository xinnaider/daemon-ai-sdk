import type { ProviderId, DaemonEvent, DaemonEventType } from "../domain/events.js";
import type { NormalizeInput } from "./eventNormalizer.js";

let seqCounter = 0;

export function createNormalizedEvent(
  input: NormalizeInput,
  type: string,
  extra: Record<string, unknown> = {},
  index = 0,
): DaemonEvent {
  seqCounter += 1;
  return {
    id: `evt_${input.sequence}_${seqCounter}`,
    runId: input.runId,
    provider: input.provider,
    type: type as DaemonEventType,
    createdAt: new Date().toISOString(),
    sequence: input.sequence + index,
    data: { raw: input.raw, ...extra },
  };
}

export function createNormalizedEvents(
  input: NormalizeInput,
  types: string[],
  extras: Record<string, unknown>[] = [],
): DaemonEvent[] {
  return types.map((type, i) =>
    createNormalizedEvent(input, type, extras[i] ?? {}, i),
  );
}
