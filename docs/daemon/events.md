# Events

Every daemon event conforms to a common envelope. Raw provider payloads are preserved alongside normalized events.

## Event Envelope

```typescript
{
  id: string;
  runId: string;
  provider: "opencode" | "codex" | "claude";
  type: DaemonEventType;
  createdAt: string;       // ISO 8601
  sequence: number;
  data: Record<string, unknown>;
}
```

## Normalized Event Types

| Event type | Description |
|------------|-------------|
| `run.created` | Run was queued |
| `run.started` | Run started execution |
| `run.status_changed` | Run status transition |
| `run.completed` | Run finished successfully |
| `run.failed` | Run terminated with an error |
| `run.cancelled` | Run was cancelled by user |
| `message.started` | Agent message began |
| `message.delta` | Message content delta |
| `message.completed` | Message finished |
| `reasoning.started` | Reasoning block began |
| `reasoning.delta` | Reasoning content delta |
| `reasoning.completed` | Reasoning block finished |
| `tool.started` | Tool call began |
| `tool.delta` | Tool progress update |
| `tool.completed` | Tool call finished |
| `tool.failed` | Tool call failed |
| `file.changed` | File was created, modified, or deleted |
| `todo.updated` | Task list or todo was updated |
| `permission.requested` | Permission prompt for a tool |
| `permission.resolved` | Permission was resolved |
| `permission.denied` | Permission was denied |
| `usage.updated` | Token usage or cost update |
| `session.discovered` | Session/thread was discovered |
| `session.updated` | Session metadata changed |
| `provider.raw` | Raw provider payload (always emitted before normalized events) |
| `provider.warning` | Provider-specific warning |
| `provider.capabilities` | Provider capability metadata |
| `log.entry` | Internal log entry |
| `unknown` | Unrecognized provider event (payload preserved in `data.raw`) |

## Provider Raw Event Preservation

The daemon always emits `provider.raw` before or alongside normalized events. This ensures unknown or newly introduced SDK events are not lost. Raw payloads are also persisted to the event log.

## OpenCode → Daemon Mapping

| OpenCode SDK event | Normalized event(s) |
|---|---|
| `session.created` / `child_session` | `session.discovered` |
| `session.updated` | `session.updated` |
| `session.deleted` | `session.deleted` |
| `message.created` | `message.started` |
| `message.updated` | `message.delta`, `message.completed` |
| `part.text_delta` | `message.delta` |
| `tool.start` | `tool.started` |
| `tool.update` | `tool.delta` |
| `tool.finish` | `tool.completed` |
| `permission.request` | `permission.requested` |
| `permission.reply` | `permission.resolved` |
| `file.status_update` | `file.changed` |
| `error` | `run.failed` |
| `tokens.cost` | `usage.updated` |

## Codex → Daemon Mapping

| Codex `ThreadEvent` | Normalized event(s) |
|---|---|
| `thread.started` | `session.discovered` |
| `turn.started` | `run.started` |
| `turn.completed` | `usage.updated`, `run.completed` |
| `turn.failed` | `run.failed` |
| `item.started/updated/completed` (type: `agent_message`) | `message.started`, `message.delta`, `message.completed` |
| `item.started/updated/completed` (type: `reasoning`) | `reasoning.started`, `reasoning.delta`, `reasoning.completed` |
| `item.started/updated/completed` (type: `command_execution`) | `tool.started`, `tool.delta`, `tool.completed`/`tool.failed` |
| `item.started/updated/completed` (type: `file_change`) | `file.changed` |
| `item.started/updated/completed` (type: `mcp_tool_call`) | `tool.started`, `tool.completed` |
| `item.started/updated/completed` (type: `web_search`) | `tool.started`, `tool.completed` |
| `item.started/updated/completed` (type: `todo_list`) | `todo.updated` |
| `item.started/updated/completed` (type: `error`) | `tool.failed` |
| `error` | `run.failed` |

## Claude Agent SDK → Daemon Mapping

| Claude `SDKMessage` type | Normalized event(s) |
|---|---|
| `message` (role: `assistant` / `user`) | `message.started`, `message.delta`, `message.completed` |
| `result` (status: `success`) | `usage.updated`, `run.completed` |
| `result` (status: `error_*`) | `usage.updated`, `run.failed` |
| `stream_event` | `message.delta` |
| `status` | `run.started` |
| `local_command_output` | `tool.started`, `tool.completed` |
| `hook_started` (hook: `PermissionRequest`) | `permission.requested` |
| `hook_started` (other) | `tool.started` |
| `hook_progress` | `tool.delta` |
| `hook_response` | `tool.completed` |
| `tool_progress` | `tool.delta` |
| `auth_status` | `permission.requested` |
| `task_notification` / `task_started` / `task_progress` | `todo.updated` |
| `files_persisted` | `file.changed` |
| `tool_use_summary` / `rate_limit` | `usage.updated` |
