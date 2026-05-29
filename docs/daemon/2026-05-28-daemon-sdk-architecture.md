# Daemon SDK Architecture Spec

Date: 2026-05-28
Status: design approved, awaiting spec review before implementation

## Goal

Build a standalone Node.js daemon in TypeScript that exposes agent execution over HTTP and SSE. The daemon must use real SDK integrations for OpenCode, Codex, and Claude Agent SDK, normalize provider-specific events into a common event model, and keep every raw provider event available for future consumers.

The first implementation will ship the core functional path first: create runs, stream events, normalize core events, handle permissions, cancel runs, log all inputs/events/errors, and expose provider capability metadata. The project will continue toward complete SDK coverage after that without changing the public daemon contract.

## Non-Goals

- Do not embed a desktop host, IPC bridge, or client-specific UI in the first delivery.
- Do not persist runs to a database in the first delivery.
- Do not hide provider-specific data behind lossy abstractions.
- Do not build a UI.
- Do not shell out to CLIs when a supported SDK API exists for the same operation, unless the SDK itself wraps the CLI internally.
- Do not require users to paste API keys into the daemon when the provider CLI already has a supported local authentication flow.

## References

- Paseo: https://github.com/getpaseo/paseo
- OpenCode SDK: https://opencode.ai/docs/sdk/
- OpenCode permissions: https://opencode.ai/docs/permissions/
- OpenCode providers/auth config: https://opencode.ai/docs/providers/
- Codex SDK: https://developers.openai.com/codex/sdk
- Codex TypeScript SDK source: https://github.com/openai/codex/tree/main/sdk/typescript
- Codex CLI sign-in with ChatGPT: https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt
- Claude Agent SDK TypeScript reference: https://platform.claude.com/docs/en/agent-sdk/typescript
- Claude Agent SDK permissions: https://platform.claude.com/docs/en/agent-sdk/permissions
- Claude Code authentication: https://code.claude.com/docs/en/authentication
- Claude Code legal/compliance authentication notes: https://code.claude.com/docs/en/legal-and-compliance
- Paseo security posture: https://github.com/getpaseo/paseo/blob/main/SECURITY.md

## Architectural Decisions

1. The daemon is a standalone TypeScript project with `npm`, `package-lock.json`, and `Vitest`.
2. The architecture follows ports and adapters:
   - domain and application layers know only provider ports and daemon event types;
   - SDK code lives only inside provider adapters;
   - HTTP/SSE lives only in the HTTP adapter.
3. Runtime state is in memory for v1:
   - runs;
   - event history per run;
   - connected SSE clients;
   - pending permission requests.
4. Logging is centralized from the start through an `EventLogger` port:
   - request input;
   - normalized run input;
   - raw provider events;
   - normalized daemon events;
   - permission decisions;
   - errors and cancellation.
5. The first logger implementation writes to console and an in-memory log buffer.
6. The daemon always emits `provider.raw` before or alongside normalized events, so unknown or newly introduced SDK events are not lost.
7. Provider-specific features are exposed as capabilities and provider options, not as hard-coded client/UI concepts.
8. Permission handling uses a common daemon protocol:
   - `permissionMode: "normal"` emits `permission.requested` and waits for HTTP resolution when the SDK supports interactive permission callbacks;
   - `permissionMode: "yolo"` maps to each provider's bypass or allow-all behavior when supported;
   - unsupported permission behavior is reported through capability metadata and a normalized warning/error event.
9. Authentication is CLI-auth-first:
   - `authMode: "auto"` is the default and tries provider CLI/local auth before SDK API-key auth;
   - `authMode: "cli"` uses only existing local CLI/server authentication;
   - `authMode: "sdk"` uses only SDK/API-key or explicit token environment variables;
   - API keys are optional fallback credentials, not required for starting the daemon.

## Stack

- Node.js 20+
- TypeScript
- Fastify for HTTP routes
- Native SSE over Fastify replies
- Vitest for unit and integration tests
- Zod for request validation
- SDK dependencies:
  - `@opencode-ai/sdk`
  - `@openai/codex-sdk`
  - `@anthropic-ai/claude-agent-sdk`

## Authentication Model

The daemon does not own provider account authentication by default. It controls orchestration, HTTP/SSE, logs, permissions, and event normalization. Model-provider authentication should remain with the provider tool wherever possible.

```ts
type AuthMode = "auto" | "cli" | "sdk";
```

Default behavior:

```text
auto:
  1. Try existing CLI/local server authentication.
  2. If unavailable, try explicit SDK/API environment credentials.
  3. If unavailable, report provider.auth_required in capabilities and events.

cli:
  Use only local provider CLI/server credentials.

sdk:
  Use only explicit SDK/API credentials.
```

Provider mapping:

- OpenCode: prefer `opencode serve` plus `@opencode-ai/sdk` client connection, using OpenCode's existing `/connect`, `auth.json`, provider config, local models, OpenCode Zen/Go, or provider env vars.
- Codex: prefer the authenticated Codex CLI account, including `codex --login` / ChatGPT sign-in where available. SDK/API-key credentials remain an explicit fallback.
- Claude: prefer Claude Code's local authentication where supported by the Agent SDK and user's permitted use case. API keys, Workload Identity Federation, cloud-provider auth, or `CLAUDE_CODE_OAUTH_TOKEN` remain explicit alternatives. Productized or third-party usage must respect Anthropic's authentication policy.

`GET /providers` must expose auth status:

```json
{
  "id": "codex",
  "auth": {
    "mode": "cli",
    "available": true,
    "source": "codex-login",
    "requiresApiKey": false,
    "message": "Codex CLI credentials detected"
  }
}
```

## Project Structure

```text
daemon/
  docs/
    daemon/
      2026-05-28-daemon-sdk-architecture.md
      running.md
      http-and-sse.md
      providers.md
      events.md
      sdk-coverage.md
  src/
    domain/
      events.ts
      permissions.ts
      providers.ts
      runs.ts
    application/
      eventBus.ts
      eventNormalizer.ts
      executionService.ts
      permissionService.ts
      runRegistry.ts
    ports/
      agentProvider.ts
      eventLogger.ts
      permissionGateway.ts
    adapters/
      http/
        routes.ts
        server.ts
        sse.ts
      logging/
        memoryEventLogger.ts
      providers/
        claude/
        codex/
        opencode/
    infrastructure/
      config.ts
      ids.ts
      time.ts
    main.ts
  tests/
    unit/
    integration/
    fixtures/
```

Dependency rule: `domain` imports nothing from `application`, `adapters`, or SDK packages. `application` imports only `domain` and `ports`. SDK packages are imported only below `adapters/providers`.

## Core Domain Model

### Run

```ts
type ProviderId = "opencode" | "codex" | "claude";
type RunStatus =
  | "queued"
  | "running"
  | "waiting_for_permission"
  | "completed"
  | "failed"
  | "cancelled";

type PermissionMode = "normal" | "yolo";
type AuthMode = "auto" | "cli" | "sdk";

type AgentRunRequest = {
  provider: ProviderId;
  prompt: string | ProviderInputPart[];
  authMode?: AuthMode;
  cwd?: string;
  model?: string;
  permissionMode: PermissionMode;
  allowedTools?: string[];
  disallowedTools?: string[];
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
  providerOptions?: Record<string, unknown>;
};
```

### Provider Port

```ts
interface AgentProvider {
  id: ProviderId;
  getCapabilities(): Promise<ProviderCapabilities>;
  listActions(): Promise<SdkActionDescriptor[]>;
  executeProviderAction?(action: ProviderSdkActionRequest): Promise<SdkActionResult>;
  executeRunAction?(action: RunSdkActionRequest): Promise<SdkActionResult>;
  startRun(input: ProviderRunInput, sink: ProviderEventSink): Promise<ProviderRunHandle>;
  resumeRun?(input: ProviderResumeInput, sink: ProviderEventSink): Promise<ProviderRunHandle>;
  cancelRun(handle: ProviderRunHandle): Promise<void>;
  resolvePermission?(input: ProviderPermissionResolution): Promise<void>;
}
```

Provider adapters expose every supported SDK call through a strictly enumerated action registry. The HTTP contract stays stable while provider-specific SDK coverage grows.

### Event Logger Port

```ts
interface EventLogger {
  log(entry: LogEntry): Promise<void>;
  list(filter?: LogFilter): Promise<LogEntry[]>;
}
```

All core services receive a logger. No service writes directly to `console`.

## HTTP API

### Health and Capabilities

```text
GET /health
GET /providers
GET /providers/:provider
GET /providers/:provider/actions
POST /providers/:provider/actions
GET /logs
```

`/providers` returns SDK availability, supported lifecycle operations, permission modes, known event types, supported options, SDK action names, and limitations.

`POST /providers/:provider/actions` executes provider-level SDK calls that are not tied to a live run. Examples: OpenCode `config.providers`, Codex `startThread`, Claude `listSessions`.

### Runs

```text
POST /runs
POST /runs/opencode
POST /runs/codex
POST /runs/claude
GET /runs
GET /runs/:runId
GET /runs/:runId/events
GET /events
POST /runs/:runId/cancel
POST /runs/:runId/permissions/:permissionId
POST /runs/:runId/resume
POST /runs/:runId/actions
```

Provider-specific endpoints are convenience wrappers around `POST /runs` with a fixed `provider`.

`POST /runs/:runId/actions` executes SDK calls that require a live run or active query handle. Examples: Claude `Query.interrupt`, `Query.setModel`, `Query.mcpServerStatus`.

### SDK Actions

Provider adapters expose a strictly enumerated action registry. The daemon does not accept arbitrary method names. Each action describes:

```ts
type SdkActionDescriptor = {
  id: string;
  provider: ProviderId;
  scope: "provider" | "run";
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  streaming: boolean;
  sideEffects: "none" | "memory" | "provider" | "filesystem" | "network";
  permissionModeRequired?: PermissionMode;
};
```

Action request:

```json
{
  "action": "session.list",
  "input": {}
}
```

Action response:

```json
{
  "provider": "opencode",
  "action": "session.list",
  "ok": true,
  "result": [],
  "raw": {}
}
```

Action failures use the normal daemon error envelope and are also logged.

### SSE

`GET /runs/:runId/events` streams one run. `GET /events` streams all runs.

SSE frame:

```text
id: <eventId>
event: <daemonEventType>
data: <json encoded DaemonEvent>
```

SSE clients receive prior buffered events for the run before live events. The buffer is in memory for v1.

## Normalized Events

Every event has this envelope:

```ts
type DaemonEvent = {
  id: string;
  runId: string;
  provider: ProviderId;
  type: DaemonEventType;
  createdAt: string;
  sequence: number;
  raw?: unknown;
  data: Record<string, unknown>;
};
```

Event types:

```text
run.created
run.started
run.status_changed
provider.raw
provider.warning
provider.capabilities
message.started
message.delta
message.completed
reasoning.started
reasoning.delta
reasoning.completed
tool.started
tool.delta
tool.completed
tool.failed
file.changed
todo.updated
permission.requested
permission.resolved
permission.denied
usage.updated
session.discovered
session.updated
run.completed
run.failed
run.cancelled
log.entry
unknown
```

Normalization rules:

- Always keep raw provider payload in `provider.raw` and in logger entries.
- If a provider event maps cleanly, emit both `provider.raw` and the normalized event.
- If a provider event is known but intentionally not normalized yet, emit `provider.raw` and `provider.warning`.
- If a provider event is unknown, emit `provider.raw` and `unknown`.
- Normalizers are pure functions with fixture-based tests.

## Permission Protocol

### Request Event

```json
{
  "type": "permission.requested",
  "data": {
    "permissionId": "perm_...",
    "toolName": "Bash",
    "toolInput": {},
    "reason": "provider supplied reason",
    "suggestions": [],
    "agentId": "optional",
    "expiresAt": "optional ISO timestamp"
  }
}
```

### Resolution Request

```http
POST /runs/:runId/permissions/:permissionId
```

```json
{
  "decision": "allow",
  "scope": "once",
  "updatedInput": {},
  "updatedPermissions": []
}
```

Decisions:

```text
allow
deny
```

Scopes:

```text
once
session
always
```

`scope` is best effort. The adapter maps it to provider-supported permission update mechanisms. If a provider cannot persist the scope, it emits `provider.warning` and applies the closest supported behavior.

### Provider Mapping

Claude:

- `normal` uses `permissionMode: "default"` and `canUseTool`.
- `yolo` uses `permissionMode: "bypassPermissions"`.
- Supports allow/deny and updated permissions through `PermissionResult`.
- Also surfaces `permission_denied` system messages and `PermissionRequest` hooks.

Codex:

- `normal` maps to thread options `approvalPolicy: "on-request"` and a safe sandbox mode.
- `yolo` maps to `approvalPolicy: "never"` plus `sandboxMode: "danger-full-access"` only when explicitly requested by the run.
- The TypeScript SDK currently exposes approval policy and sandbox options, but not a first-class daemon callback equivalent to Claude `canUseTool`. The daemon records this as capability metadata and normalizes any permission/approval related events exposed by the stream.

OpenCode:

- `normal` maps to OpenCode permission rules that ask when tools need approval, plus `postSessionByIdPermissionsByPermissionId` for resolution.
- `yolo` maps to permission rules that allow requested tools where supported.
- The adapter must use `event.subscribe()` and the generated permission reply endpoint.

## Provider Coverage Plan

The daemon will implement provider coverage in phases. Phase 1 focuses on the core execution loop. Later phases fill out the entire SDK surface behind the same provider capability model.

### Phase 1: Core Functional SDK Path

OpenCode:

- `createOpencode()`
- `createOpencodeClient()` when connecting to an existing server
- `global.health()`
- `config.get()`
- `config.providers()`
- `session.create()`
- `session.get()`
- `session.prompt()`
- `session.abort()`
- `postSessionByIdPermissionsByPermissionId()`
- `event.subscribe()`

Codex:

- `new Codex()`
- `startThread()`
- `resumeThread()`
- `thread.runStreamed()`
- `AbortSignal` cancellation via turn options
- thread options for `workingDirectory`, `skipGitRepoCheck`, `model`, `modelReasoningEffort`, `approvalPolicy`, `sandboxMode`, `networkAccessEnabled`, `webSearchMode`, `additionalDirectories`
- turn options for `outputSchema`
- structured prompt input with text and local images

Claude:

- `query()`
- async iteration over `SDKMessage`
- `includePartialMessages`
- `permissionMode`
- `allowedTools`
- `disallowedTools`
- `canUseTool`
- `abortController`
- `cwd`
- `model`
- `maxTurns`
- `mcpServers`
- `agents`
- `Query.interrupt()`
- `Query.close()`
- `Query.initializationResult()`
- `Query.supportedCommands()`
- `Query.supportedModels()`
- `Query.supportedAgents()`
- `Query.accountInfo()`
- `listSessions()`
- `getSessionMessages()`
- `getSessionInfo()`

### Phase 2: Full Lifecycle and Discovery Coverage

OpenCode:

- `app.log()`
- `app.agents()`
- `project.list()`
- `project.current()`
- `path.get()`
- `session.list()`
- `session.children()`
- `session.delete()`
- `session.update()`
- `session.init()`
- `session.share()`
- `session.unshare()`
- `session.summarize()`
- `session.messages()`
- `session.message()`
- `session.command()`
- `session.shell()`
- `session.revert()`
- `session.unrevert()`
- `find.text()`
- `find.files()`
- `find.symbols()`
- `file.read()`
- `file.status()`
- `auth.set()`

Codex:

- buffered `thread.run()`
- all `CodexOptions`: `codexPathOverride`, `baseUrl`, `apiKey`, `config`, `env`
- complete `ThreadOptions`: `model`, `sandboxMode`, `workingDirectory`, `skipGitRepoCheck`, `modelReasoningEffort`, `networkAccessEnabled`, `webSearchMode`, `webSearchEnabled`, `approvalPolicy`, `additionalDirectories`
- complete `TurnOptions`: `outputSchema`, `signal`
- multimodal input entries
- thread id exposure for resume
- output schema lifecycle and cleanup behavior

Claude:

- `tool()`
- `createSdkMcpServer()`
- `renameSession()`
- `tagSession()`
- `Query.rewindFiles()`
- `Query.setPermissionMode()`
- `Query.setModel()`
- `Query.setMaxThinkingTokens()`
- `Query.mcpServerStatus()`
- `Query.reconnectMcpServer()`
- `Query.toggleMcpServer()`
- `Query.setMcpServers()`
- `Query.streamInput()`
- `Query.stopTask()`
- hooks
- custom tools
- file checkpointing
- structured output
- subagents
- slash commands
- skills
- plugins
- cost and usage tracking
- todo lists

### Phase 3: Provider-Specific Advanced Surfaces

OpenCode:

- TUI methods are documented and exposed only through a separate opt-in namespace because they control UI state rather than daemon execution:
  - `tui.appendPrompt()`
  - `tui.openHelp()`
  - `tui.openSessions()`
  - `tui.openThemes()`
  - `tui.openModels()`
  - `tui.submitPrompt()`
  - `tui.clearPrompt()`
  - `tui.executeCommand()`
  - `tui.showToast()`

Codex:

- future SDK event types discovered from source or package upgrades
- any new app-server or SDK APIs when they become official in the TypeScript package

Claude:

- V2 preview interface once stable enough for a production daemon adapter
- sandbox settings:
  - network config
  - filesystem config
  - fallback permissions for unsandboxed commands

## Provider Event Homologation

### OpenCode Events

Source of truth: `@opencode-ai/sdk` generated types and `event.subscribe()`.

The daemon records all SSE events as `provider.raw`. The normalizer will recognize the following classes first:

```text
session lifecycle
message lifecycle
part text deltas
tool start/update/finish
permission request/reply
file status/update
error
cost/usage/tokens when present
child session/agent events when present
```

The documentation implementation must include an autogenerated or manually verified event table from the installed SDK package so future package upgrades can be diffed.

### Codex Events

Source of truth: `@openai/codex-sdk` TypeScript source exports `ThreadEvent`:

```text
thread.started
turn.started
turn.completed
turn.failed
item.started
item.updated
item.completed
error
```

Known `ThreadItem` types:

```text
agent_message
reasoning
command_execution
file_change
mcp_tool_call
web_search
todo_list
error
```

Normalization:

- `thread.started` -> `session.discovered`
- `turn.started` -> `run.started` or `run.status_changed`
- `item.started` -> `message.started`, `tool.started`, `reasoning.started`, `todo.updated`, or `provider.raw`
- `item.updated` -> `message.delta`, `tool.delta`, `reasoning.delta`, `todo.updated`, or `provider.raw`
- `item.completed` -> `message.completed`, `tool.completed`, `file.changed`, `reasoning.completed`, `todo.updated`, or `tool.failed`
- `turn.completed` -> `usage.updated` and `run.completed`
- `turn.failed` -> `run.failed`
- `error` -> `run.failed` or `provider.warning` depending on severity

### Claude Agent SDK Events

Source of truth: `SDKMessage` union and Query control methods from the TypeScript reference.

Known message types:

```text
assistant
user
user replay
result
system init
stream_event
compact_boundary
status
local_command_output
hook_started
hook_progress
hook_response
tool_progress
auth_status
task_notification
task_started
task_progress
files_persisted
tool_use_summary
rate_limit
prompt_suggestion
```

Known hook events:

```text
PreToolUse
PostToolUse
PostToolUseFailure
Notification
UserPromptSubmit
SessionStart
SessionEnd
Stop
SubagentStart
SubagentStop
PreCompact
PermissionRequest
Setup
TeammateIdle
TaskCompleted
ConfigChange
WorktreeCreate
WorktreeRemove
```

Known tool input families:

```text
Agent
AskUserQuestion
Bash
TaskOutput
Config
EnterWorktree
ExitPlanMode
FileEdit
FileRead
FileWrite
Glob
Grep
ListMcpResources
Mcp
NotebookEdit
ReadMcpResource
SubscribeMcpResource
SubscribePolling
TaskStop
TodoWrite
UnsubscribeMcpResource
UnsubscribePolling
WebFetch
WebSearch
```

Normalization:

- `assistant` content text -> `message.completed`
- `stream_event` deltas -> `message.delta`, `reasoning.delta`, or `tool.delta`
- `assistant` content tool use -> `tool.started`
- `user` tool result -> `tool.completed` or `tool.failed`
- `result success` -> `usage.updated` and `run.completed`
- `result error_*` -> `usage.updated` and `run.failed`
- `system init` -> `session.discovered` and `provider.capabilities`
- `system compact_boundary` -> `session.updated`
- permission denials -> `permission.denied`
- hook progress and tool progress -> `tool.delta` or `provider.raw`
- rate limit -> `provider.warning`
- task/todo events -> `todo.updated`

## Testing Strategy

Use TDD for production code:

1. Write a failing test for the desired behavior.
2. Verify it fails for the expected reason.
3. Implement the smallest code to pass.
4. Run the targeted test.
5. Refactor only after green.

Test suites:

- `events`: pure normalizer tests for OpenCode, Codex, Claude, and unknown raw events.
- `logging`: every request/raw/normalized/error path reaches `EventLogger`.
- `eventBus`: ordered delivery, replay buffer, all-runs stream, per-run stream.
- `permissions`: pending permission creation, timeout/cancel behavior, allow/deny mapping.
- `http`: health, providers, runs, cancel, permission resolution.
- `sse`: proper headers, replay, live events, disconnect cleanup.
- `providers`: SDK adapters with injected SDK clients and mocked async generators.
- `integration`: start server on ephemeral port and exercise HTTP/SSE end to end without real paid SDK calls.

Real SDK smoke tests are opt-in and skipped unless env vars are present:

```text
RUN_REAL_SDK_TESTS=1
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
OPENCODE_DAEMON_REAL_TEST=1
```

## Environment Variables

Daemon:

```text
DAEMON_HOST=127.0.0.1
DAEMON_PORT=4317
DAEMON_LOG_LEVEL=info
DAEMON_EVENT_BUFFER_SIZE=1000
```

Claude:

```text
ANTHROPIC_API_KEY
CLAUDE_CODE_OAUTH_TOKEN
```

Codex:

```text
OPENAI_API_KEY
CODEX_API_KEY
```

OpenCode:

OpenCode reads provider-specific environment variables according to its config and provider list. The daemon must pass per-run `env` overrides to the OpenCode SDK/server where supported and must never log secret values.

Provider API keys are optional. The preferred local workflow is to authenticate each provider through its own CLI or local server first:

```text
claude        # login/configure Claude Code
codex --login # login/configure Codex CLI
opencode      # /connect or configure providers/local models
```

## Security and Logging Rules

- Redact environment values and API keys before logging.
- Log key names, not secret values.
- Do not persist provider secrets in daemon memory longer than the SDK call requires.
- Do not copy subscription/OAuth credentials out of provider-owned storage.
- `permissionMode: "yolo"` must be explicit per run.
- `danger-full-access` or equivalent must never be implied by default.
- `cwd` is accepted as input but logged as a path string only.
- Permission decisions are auditable through logs and events.
- Unknown provider events are preserved but still passed through redaction.

## Documentation Deliverables

Create and keep updated:

```text
docs/daemon/running.md
docs/daemon/http-and-sse.md
docs/daemon/providers.md
docs/daemon/events.md
docs/daemon/sdk-coverage.md
```

Each implementation phase must update documentation before the phase is considered complete.

## Acceptance Criteria for First Delivery

- TypeScript project compiles.
- HTTP server starts and exposes `/health`.
- `GET /providers` returns OpenCode, Codex, Claude capability metadata.
- `GET /providers` reports `auth.mode`, `auth.available`, `auth.source`, and `auth.requiresApiKey` for each provider.
- The daemon starts without provider API keys.
- Run requests support `authMode: "auto" | "cli" | "sdk"` and default to `auto`.
- `GET /providers/:provider/actions` lists all daemon-supported SDK calls for that provider.
- `POST /providers/:provider/actions` executes provider-level SDK calls from the enumerated action registry.
- `POST /runs/:runId/actions` executes run-bound SDK calls from the enumerated action registry.
- `POST /runs/:provider` creates a run with real SDK adapter wiring.
- `GET /runs/:runId/events` streams SSE events.
- `GET /events` streams all run events.
- All provider raw events are logged and emitted.
- Core provider events are normalized into daemon events.
- `permissionMode: "normal"` and `permissionMode: "yolo"` are represented in the common request model.
- Claude interactive permissions use daemon permission request/response.
- OpenCode permission replies use the SDK endpoint where available.
- Codex permission and sandbox limitations are documented in capabilities.
- `POST /runs/:runId/cancel` cancels or aborts active runs where supported.
- Tests cover HTTP, SSE, event normalization, logging, permissions, and provider adapters.
- Tests cover SDK action dispatch for every provider action registered by the adapters.
- Docs explain how to run, configure SDK env vars, test HTTP, test SSE, understand adapters, and integrate external clients later.

## Future Client Integration

Any HTTP/SSE client can consume:

- `POST /runs` to start work;
- `GET /runs/:runId/events` for per-session stream;
- `POST /runs/:runId/permissions/:permissionId` for approval UI;
- `GET /providers` for provider/model/capability discovery.

No host-specific IPC, embedded UI state, or non-HTTP coupling should be introduced in this daemon.

## Spec Review

Self-review result:

- Placeholder scan: no placeholder sections remain.
- Consistency check: architecture, event model, permission protocol, and phased SDK coverage align.
- Scope check: first delivery is implementable while complete SDK coverage is explicitly tracked as later phases.
- Ambiguity check: `normal` and `yolo` behavior is mapped by provider and unsupported parity is surfaced as capabilities and warnings.
