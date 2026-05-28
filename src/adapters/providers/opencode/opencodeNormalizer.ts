import type { DaemonEvent, DaemonEventType } from "../../../domain/events.js";
import type { NormalizeInput } from "../../../application/eventNormalizer.js";

function evt(input: NormalizeInput, type: string, extra: Record<string, unknown> = {}): DaemonEvent {
  return {
    id: `evt_${input.sequence}`,
    runId: input.runId,
    provider: input.provider,
    type: type as DaemonEventType,
    createdAt: new Date().toISOString(),
    sequence: input.sequence,
    data: { raw: input.raw, ...extra },
  };
}

export function normalizeOpenCodeEvent(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const eventType = (raw.type as string) ?? "";

  switch (eventType) {
    case "session.created":
    case "child_session":
      return [evt(input, "session.discovered")];

    case "session.updated":
      return [evt(input, "session.updated")];

    case "session.deleted":
      return [evt(input, "session.deleted")];

    case "message.created":
      return [evt(input, "message.started")];

    case "message.updated":
      return [
        evt(input, "message.delta"),
        evt(input, "message.completed"),
      ];

    case "part.text_delta":
      return [evt(input, "message.delta")];

    case "tool.start":
      return [evt(input, "tool.started")];

    case "tool.update":
      return [evt(input, "tool.delta")];

    case "tool.finish":
      return [evt(input, "tool.completed")];

    case "permission.request":
      return [evt(input, "permission.requested")];

    case "permission.reply":
      return [evt(input, "permission.resolved")];

    case "file.status_update":
      return [evt(input, "file.changed")];

    case "error":
      return [evt(input, "run.failed")];

    case "tokens.cost":
      return [evt(input, "usage.updated")];

    default:
      return [evt(input, "unknown")];
  }
}
