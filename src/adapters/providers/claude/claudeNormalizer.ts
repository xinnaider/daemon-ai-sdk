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

export function normalizeClaudeMessage(input: NormalizeInput): DaemonEvent[] {
  const raw = input.raw as Record<string, unknown>;
  const msgType = (raw.type as string) ?? "";

  switch (msgType) {
    case "message": {
      const message = raw.message as Record<string, unknown> | undefined;
      const role = (message?.role as string) ?? "";
      if (role === "assistant" || role === "user") {
        return [
          evt(input, "message.started"),
          evt(input, "message.delta"),
          evt(input, "message.completed"),
        ];
      }
      return [evt(input, "unknown")];
    }

    case "result": {
      const result = raw.result as Record<string, unknown> | undefined;
      const status = (result?.status as string) ?? "";
      if (status === "success") {
        return [evt(input, "run.completed")];
      }
      return [evt(input, "run.failed")];
    }

    case "stream_event":
      return [evt(input, "message.delta")];

    case "status":
      return [evt(input, "run.started")];

    case "local_command_output":
      return [
        evt(input, "tool.started"),
        evt(input, "tool.completed"),
      ];

    case "hook_started": {
      const hook = (raw.hook as string) ?? "";
      if (hook === "PermissionRequest") {
        return [evt(input, "permission.requested")];
      }
      return [evt(input, "tool.started")];
    }

    case "hook_progress":
      return [evt(input, "tool.delta")];

    case "hook_response":
      return [evt(input, "tool.completed")];

    case "tool_progress":
      return [evt(input, "tool.delta")];

    case "auth_status":
      return [evt(input, "permission.requested")];

    case "task_notification":
    case "task_started":
    case "task_progress":
      return [evt(input, "todo.updated")];

    case "files_persisted":
      return [evt(input, "file.changed")];

    case "tool_use_summary":
    case "rate_limit":
      return [evt(input, "usage.updated")];

    default:
      return [evt(input, "unknown")];
  }
}
