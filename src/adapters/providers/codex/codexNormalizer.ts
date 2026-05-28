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

export function normalizeCodexEvent(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const eventType = (raw.type as string) ?? "";

  switch (eventType) {
    case "thread.started":
      return [evt(input, "session.discovered")];

    case "turn.started":
      return [evt(input, "run.started")];

    case "turn.completed": {
      const events: DaemonEvent[] = [];
      if (raw.data && typeof raw.data === "object") {
        events.push(evt(input, "usage.updated", { usage: (raw.data as Record<string, unknown>).usage }));
      }
      events.push(evt(input, "run.completed"));
      return events;
    }

    case "turn.failed":
      return [evt(input, "run.failed")];

    case "item.started":
    case "item.updated":
    case "item.completed": {
      const item = raw.item as Record<string, unknown> | undefined;
      const itemType = (item?.type as string) ?? "";

      switch (itemType) {
        case "agent_message":
          return [
            evt(input, "message.started"),
            evt(input, "message.delta"),
            evt(input, "message.completed"),
          ];
        case "reasoning":
          return [
            evt(input, "reasoning.started"),
            evt(input, "reasoning.delta"),
            evt(input, "reasoning.completed"),
          ];
        case "command_execution":
          return [
            evt(input, "tool.started"),
            evt(input, "tool.delta"),
            evt(input, "tool.completed"),
          ];
        case "file_change":
          return [evt(input, "file.changed")];
        case "mcp_tool_call":
          return [
            evt(input, "tool.started"),
            evt(input, "tool.completed"),
          ];
        case "web_search":
          return [
            evt(input, "tool.started"),
            evt(input, "tool.completed"),
          ];
        case "todo_list":
          return [evt(input, "todo.updated")];
        case "error":
          return [evt(input, "tool.failed")];
        default:
          return [evt(input, "unknown")];
      }
    }

    case "error":
      return [evt(input, "run.failed")];

    default:
      return [evt(input, "unknown")];
  }
}
