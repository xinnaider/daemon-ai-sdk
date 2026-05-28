# Providers

Three providers are supported: **OpenCode**, **Codex**, and **Claude**.

Each provider adapter wraps the official SDK, normalizes events into the daemon event model, and exposes available SDK calls through a strictly enumerated action registry.

## OpenCode Adapter

Uses `@opencode-ai/sdk`.

- **Auth**: Detects `opencode` CLI. Falls back to `OPENCODE_API_KEY` env var or test mode via `OPENCODE_DAEMON_REAL_TEST`.
- **Permissions**: `normal` maps to OpenCode permission rules (ask on approval-needed tools). `yolo` maps to permission rules that allow requested tools. Permission resolution uses the SDK's `session.permission.reply` endpoint.
- **Event streaming**: Subscribes via `event.subscribe()` and normalizes session, message, tool, permission, file, and usage events.
- **Actions**: 30+ SDK actions across provider scope (`global.health`, `config.get`, `config.providers`, `app.log`, `app.agents`, `path.get`, `project.*`, `auth.set`) and run scope (`session.*`, `find.*`, `file.*`, `tui.*`).

## Codex Adapter

Uses `@openai/codex-sdk`.

- **Auth**: Detects `codex` CLI. Falls back to `OPENAI_API_KEY` or `CODEX_API_KEY` env vars.
- **Permissions**: `normal` maps to `approvalPolicy: "on-request"`. `yolo` maps to `approvalPolicy: "never"` with `sandboxMode: "danger-full-access"`.
- **Event streaming**: Iterates `thread.runStreamed()` output and normalizes thread/turn/item events.
- **Actions**: Provider scope: `thread.start`. Run scope: `thread.resume`, `thread.run`, `thread.runStreamed`, `turn.cancel`.

### Known Limitations

- No first-class daemon permission callback equivalent to Claude's `canUseTool`. Approval policy and sandbox options are set at thread creation.
- Sandbox mode is reported through capability metadata.

## Claude Adapter

Uses `@anthropic-ai/claude-agent-sdk`.

- **Auth**: Detects `claude` CLI. Falls back to `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` env vars.
- **Permissions**: `normal` uses `permissionMode: "default"` with a `canUseTool` callback routed through the daemon permission service. `yolo` uses `permissionMode: "bypassPermissions"`.
- **Event streaming**: Iterates async `SDKMessage` stream. Normalizes message, stream_event, status, tool, permission, task, file, and usage events.
- **Actions**: Provider scope: `tool.create`, `mcp.createSdkMcpServer`, `sessions.*`. Run scope: `query.*` (interrupt, close, setModel, setPermissionMode, etc.).

### Known Limitations

- Permission scopes (`once`, `always`, `until_reply`) are best-effort. The adapter maps to provider-supported mechanisms and emits `provider.warning` if the scope cannot be persisted.

## Auth Mode

| Mode | Behavior |
|------|----------|
| `auto` | Try CLI/local auth first. Fall back to SDK/API env vars. Report `auth_required` if neither is available. |
| `cli` | Use only local CLI/server credentials. Fail if CLI is not found. |
| `sdk` | Use only SDK/API-key or explicit token environment variables. |

All modes default to `auto` when not specified in the run request.

## Auth Detection

Each provider's `GET /providers` response includes an `auth` object:

```json
{
  "id": "codex",
  "auth": {
    "mode": "auto",
    "available": true,
    "source": "cli",
    "requiresApiKey": false
  }
}
```

- `mode`: Current auth mode (`auto`, `cli`, or `sdk`).
- `available`: Whether the daemon can reach the provider.
- `source`: How auth was detected (`"cli"`, `"env"`, or `null`).
- `requiresApiKey`: Whether an API key is needed (`false` when CLI auth is available).

The daemon starts without any API keys. Providers with CLI auth available will report `requiresApiKey: false`. Providers without CLI auth will report `requiresApiKey: true` and the caller should set the appropriate env var or use `authMode: "cli"` only if the CLI is installed.
