import type { DaemonEvent } from "../../../domain/events.js";
import type { NormalizeInput } from "../../../application/eventNormalizer.js";
import { registerNormalizer } from "../../../application/eventNormalizer.js";
import { createNormalizedEvent, createNormalizedEvents } from "../../../application/eventFactory.js";

export function normalizeClaudeMessage(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const msgType = (raw.type as string) ?? "";

  switch (msgType) {
    case "message": {
      const message = raw.message as Record<string, unknown> | undefined;
      const role = (message?.role as string) ?? "";
      if (role === "assistant" || role === "user") {
        return createNormalizedEvents(input, ["message.started", "message.delta", "message.completed"]);
      }
      return [createNormalizedEvent(input, "unknown")];
    }

    case "result": {
      const result = raw.result as Record<string, unknown> | undefined;
      const status = (result?.status as string) ?? "";
      if (status === "success") {
        return [createNormalizedEvent(input, "run.completed")];
      }
      return [createNormalizedEvent(input, "run.failed")];
    }

    case "stream_event":
      return [createNormalizedEvent(input, "message.delta")];

    case "status":
      return [createNormalizedEvent(input, "run.started")];

    case "local_command_output":
      return createNormalizedEvents(input, ["tool.started", "tool.completed"]);

    case "hook_started": {
      const hook = (raw.hook as string) ?? "";
      if (hook === "PermissionRequest") {
        return [createNormalizedEvent(input, "permission.requested")];
      }
      return [createNormalizedEvent(input, "tool.started")];
    }

    case "hook_progress":
      return [createNormalizedEvent(input, "tool.delta")];

    case "hook_response":
      return [createNormalizedEvent(input, "tool.completed")];

    case "tool_progress":
      return [createNormalizedEvent(input, "tool.delta")];

    case "auth_status":
      return [createNormalizedEvent(input, "permission.requested")];

    case "task_notification":
    case "task_started":
    case "task_progress":
      return [createNormalizedEvent(input, "todo.updated")];

    case "files_persisted":
      return [createNormalizedEvent(input, "file.changed")];

    case "tool_use_summary":
    case "rate_limit":
      return [createNormalizedEvent(input, "usage.updated")];

    default:
      return [createNormalizedEvent(input, "unknown")];
  }
}

registerNormalizer("claude", normalizeClaudeMessage);
