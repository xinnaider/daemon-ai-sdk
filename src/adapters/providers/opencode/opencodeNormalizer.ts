import type { DaemonEvent } from "../../../domain/events.js";
import type { NormalizeInput } from "../../../application/eventNormalizer.js";
import { registerNormalizer } from "../../../application/eventNormalizer.js";
import { createNormalizedEvent, createNormalizedEvents } from "../../../application/eventFactory.js";

export function normalizeOpenCodeEvent(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const eventType = (raw.type as string) ?? "";

  switch (eventType) {
    case "session.created":
    case "child_session":
      return [createNormalizedEvent(input, "session.discovered")];

    case "session.updated":
      return [createNormalizedEvent(input, "session.updated")];

    case "session.deleted":
      return [createNormalizedEvent(input, "session.deleted")];

    case "message.created":
      return [createNormalizedEvent(input, "message.started")];

    case "message.updated":
      return createNormalizedEvents(input, ["message.delta", "message.completed"]);

    case "part.text_delta":
      return [createNormalizedEvent(input, "message.delta")];

    case "tool.start":
      return [createNormalizedEvent(input, "tool.started")];

    case "tool.update":
      return [createNormalizedEvent(input, "tool.delta")];

    case "tool.finish":
      return [createNormalizedEvent(input, "tool.completed")];

    case "permission.request":
      return [createNormalizedEvent(input, "permission.requested")];

    case "permission.reply":
      return [createNormalizedEvent(input, "permission.resolved")];

    case "file.status_update":
      return [createNormalizedEvent(input, "file.changed")];

    case "error":
      return [createNormalizedEvent(input, "run.failed")];

    case "tokens.cost":
      return [createNormalizedEvent(input, "usage.updated")];

    default:
      return [createNormalizedEvent(input, "unknown")];
  }
}

registerNormalizer("opencode", normalizeOpenCodeEvent);
