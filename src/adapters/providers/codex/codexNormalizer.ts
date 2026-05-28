import type { DaemonEvent } from "../../../domain/events.js";
import type { NormalizeInput } from "../../../application/eventNormalizer.js";
import { registerNormalizer } from "../../../application/eventNormalizer.js";
import { createNormalizedEvents, createNormalizedEvent } from "../../../application/eventFactory.js";

export function normalizeCodexEvent(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const eventType = (raw.type as string) ?? "";

  switch (eventType) {
    case "thread.started":
      return [createNormalizedEvent(input, "session.discovered")];

    case "turn.started":
      return [createNormalizedEvent(input, "run.started")];

    case "turn.completed": {
      const events: DaemonEvent[] = [];
      if (raw.data && typeof raw.data === "object") {
        events.push(createNormalizedEvent(input, "usage.updated", { usage: (raw.data as Record<string, unknown>).usage }));
      }
      events.push(createNormalizedEvent(input, "run.completed"));
      return events;
    }

    case "turn.failed":
      return [createNormalizedEvent(input, "run.failed")];

    case "item.started":
    case "item.updated":
    case "item.completed": {
      const item = raw.item as Record<string, unknown> | undefined;
      const itemType = (item?.type as string) ?? "";

      const hasError = !!(raw.data as Record<string, unknown> | undefined)?.error;

      switch (itemType) {
        case "agent_message":
          return createNormalizedEvents(input, ["message.started", "message.delta", "message.completed"]);
        case "reasoning":
          return createNormalizedEvents(input, ["reasoning.started", "reasoning.delta", "reasoning.completed"]);
        case "command_execution": {
          if (hasError) {
            return createNormalizedEvents(input, ["tool.started", "tool.delta", "tool.failed"]);
          }
          return createNormalizedEvents(input, ["tool.started", "tool.delta", "tool.completed"]);
        }
        case "file_change":
          return [createNormalizedEvent(input, "file.changed")];
        case "mcp_tool_call":
          return createNormalizedEvents(input, ["tool.started", "tool.completed"]);
        case "web_search":
          return createNormalizedEvents(input, ["tool.started", "tool.completed"]);
        case "todo_list":
          return [createNormalizedEvent(input, "todo.updated")];
        case "error":
          return [createNormalizedEvent(input, "tool.failed")];
        default:
          return [createNormalizedEvent(input, "unknown")];
      }
    }

    case "error":
      return [createNormalizedEvent(input, "run.failed")];

    default:
      return [createNormalizedEvent(input, "unknown")];
  }
}

registerNormalizer("codex", normalizeCodexEvent);
