# SDK Coverage Matrix

Auto-generated from the action registry and event normalizers.

## Packages

| Provider | Package |
| --- | --- |
| OpenCode | `@opencode-ai/sdk` |
| Codex | `@openai/codex-sdk` |
| Claude | `@anthropic-ai/claude-agent-sdk` |

## OpenCode Actions

| Action ID | Scope | Streaming | Side Effects |
| --- | --- | --- | --- |
| `global.health` | provider | No | No |
| `app.log` | provider | No | No |
| `app.agents` | provider | No | No |
| `config.get` | provider | No | No |
| `config.providers` | provider | No | No |
| `path.get` | provider | No | No |
| `project.list` | provider | No | No |
| `project.current` | provider | No | No |
| `auth.set` | provider | No | No |
| `session.list` | run | No | No |
| `session.create` | run | No | No |
| `session.get` | run | No | No |
| `session.children` | run | No | No |
| `session.delete` | run | No | No |
| `session.update` | run | No | No |
| `session.init` | run | No | No |
| `session.share` | run | No | No |
| `session.unshare` | run | No | No |
| `session.summarize` | run | No | No |
| `session.messages` | run | No | No |
| `session.message` | run | No | No |
| `session.command` | run | Yes | No |
| `session.shell` | run | Yes | No |
| `session.revert` | run | No | No |
| `session.unrevert` | run | No | No |
| `session.prompt` | run | Yes | No |
| `session.abort` | run | No | No |
| `session.permission.reply` | run | No | No |
| `find.text` | run | No | No |
| `find.files` | run | No | No |
| `find.symbols` | run | No | No |
| `file.read` | run | No | No |
| `file.status` | run | No | No |
| `tui.appendPrompt` | run | No | Yes |
| `tui.openHelp` | run | No | Yes |
| `tui.openSessions` | run | No | Yes |
| `tui.openThemes` | run | No | Yes |
| `tui.openModels` | run | No | Yes |
| `tui.submitPrompt` | run | No | Yes |
| `tui.clearPrompt` | run | No | Yes |
| `tui.executeCommand` | run | No | Yes |
| `tui.showToast` | run | No | Yes |

## Codex Actions

| Action ID | Scope | Streaming | Side Effects |
| --- | --- | --- | --- |
| `thread.start` | provider | No | No |
| `thread.resume` | run | No | No |
| `thread.run` | run | No | No |
| `thread.runStreamed` | run | Yes | No |
| `turn.cancel` | run | No | No |

## Claude Actions

| Action ID | Scope | Streaming | Side Effects |
| --- | --- | --- | --- |
| `query.run` | run | Yes | No |
| `tool.create` | provider | No | No |
| `mcp.createSdkMcpServer` | provider | No | No |
| `sessions.list` | provider | No | No |
| `sessions.messages` | provider | No | No |
| `sessions.info` | provider | No | No |
| `sessions.rename` | provider | No | No |
| `sessions.tag` | provider | No | No |
| `query.interrupt` | run | No | No |
| `query.close` | run | No | No |
| `query.initializationResult` | run | No | No |
| `query.supportedCommands` | run | No | No |
| `query.supportedModels` | run | No | No |
| `query.supportedAgents` | run | No | No |
| `query.accountInfo` | run | No | No |
| `query.rewindFiles` | run | No | No |
| `query.setPermissionMode` | run | No | No |
| `query.setModel` | run | No | No |
| `query.setMaxThinkingTokens` | run | No | No |
| `query.mcpServerStatus` | run | No | No |
| `query.reconnectMcpServer` | run | No | No |
| `query.toggleMcpServer` | run | No | No |
| `query.setMcpServers` | run | No | No |
| `query.streamInput` | run | No | No |
| `query.stopTask` | run | No | No |

## OpenCode Event Mapping

| Raw Event | Normalized Events |
| --- | --- |
| `session.created` | `session.discovered` |
| `child_session` | `session.discovered` |
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

## Codex Event Mapping

| Raw Event | Normalized Events |
| --- | --- |
| `thread.started` | `session.discovered` |
| `turn.started` | `run.started` |
| `turn.completed` | `usage.updated`, `run.completed` |
| `turn.failed` | `run.failed` |
| `item.started (agent_message)` | `message.started`, `message.delta`, `message.completed` |
| `item.started (reasoning)` | `reasoning.started`, `reasoning.delta`, `reasoning.completed` |
| `item.started (command_execution)` | `tool.started`, `tool.delta`, `tool.completed` |
| `item.started (command_execution, error)` | `tool.started`, `tool.delta`, `tool.failed` |
| `item.started (file_change)` | `file.changed` |
| `item.started (mcp_tool_call)` | `tool.started`, `tool.completed` |
| `item.started (web_search)` | `tool.started`, `tool.completed` |
| `item.started (todo_list)` | `todo.updated` |
| `item.started (error)` | `tool.failed` |
| `item.updated (agent_message)` | `message.started`, `message.delta`, `message.completed` |
| `item.updated (reasoning)` | `reasoning.started`, `reasoning.delta`, `reasoning.completed` |
| `item.updated (command_execution)` | `tool.started`, `tool.delta`, `tool.completed` |
| `item.updated (file_change)` | `file.changed` |
| `item.updated (todo_list)` | `todo.updated` |
| `item.completed (agent_message)` | `message.started`, `message.delta`, `message.completed` |
| `item.completed (reasoning)` | `reasoning.started`, `reasoning.delta`, `reasoning.completed` |
| `item.completed (command_execution)` | `tool.started`, `tool.delta`, `tool.completed` |
| `item.completed (file_change)` | `file.changed` |
| `item.completed (todo_list)` | `todo.updated` |
| `error` | `run.failed` |

## Claude Event Mapping

| Raw Event | Normalized Events |
| --- | --- |
| `message (assistant/user)` | `message.started`, `message.delta`, `message.completed` |
| `result (success)` | `run.completed` |
| `result (failed)` | `run.failed` |
| `stream_event` | `message.delta` |
| `status` | `run.started` |
| `local_command_output` | `tool.started`, `tool.completed` |
| `hook_started (PermissionRequest)` | `permission.requested` |
| `hook_started (other)` | `tool.started` |
| `hook_progress` | `tool.delta` |
| `hook_response` | `tool.completed` |
| `tool_progress` | `tool.delta` |
| `auth_status` | `permission.requested` |
| `task_notification` | `todo.updated` |
| `task_started` | `todo.updated` |
| `task_progress` | `todo.updated` |
| `files_persisted` | `file.changed` |
| `tool_use_summary` | `usage.updated` |
| `rate_limit` | `usage.updated` |

## Permission Mapping

| Provider | `normal` | `yolo` |
| --- | --- | --- |
| OpenCode | Asks when tools need approval via permission rules | Allows requested tools where supported |
| Codex | `approvalPolicy: "on-request"` + safe sandbox mode | `approvalPolicy: "never"` + `sandboxMode: "danger-full-access"` |
| Claude | `permissionMode: "default"` + `canUseTool` | `permissionMode: "bypassPermissions"` |

## Limitations

- The daemon does not persist runs to a database in v1.
- OpenCode TUI actions (`tui.*`) control UI state, not daemon execution.
- Codex SDK currently lacks a first-class daemon permission callback equivalent to Claude `canUseTool`.
- Claude `hook_started` events without `PermissionRequest` are normalized as `tool.started`.
- Unknown provider events are preserved as `provider.raw` and normalized as `unknown`.

## Real SDK Smoke Test Environment

To run real SDK integration tests, set the following environment variables:

| Variable | Required For |
| --- | --- |
| `RUN_REAL_SDK_TESTS=1` | All providers (opt-in) |
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | Codex |
| `CODEX_API_KEY` | Codex (alternative) |
| `OPENCODE_DAEMON_REAL_TEST=1` | OpenCode |

Provider CLI auth is preferred over API keys. Set up each provider through its own CLI:

- `claude` — login/configure Claude Code
- `codex --login` — login/configure Codex CLI
- `opencode` — connect or configure providers/local models
