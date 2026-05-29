# Daemon Full SDK Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone TypeScript daemon with HTTP, SSE, CLI-auth-first provider access, normalized events, centralized logging, permission mediation, and full enumerated SDK action coverage for OpenCode, Codex, and Claude Agent SDK.

**Architecture:** Use ports and adapters. Domain and application code owns daemon concepts; SDK and CLI/local-auth detection stay inside provider adapters. SDK coverage is exposed through two public surfaces: run lifecycle endpoints for streaming agent work, and enumerated SDK action endpoints for every supported non-run or run-bound SDK call. Provider authentication defaults to `authMode: "auto"`, which tries CLI/local server credentials before explicit SDK/API-key credentials.

**Tech Stack:** Node.js 20+, TypeScript, Fastify, Vitest, Zod, `@opencode-ai/sdk`, `@openai/codex-sdk`, `@anthropic-ai/claude-agent-sdk`.

---

## Source Spec

Implement against [docs/daemon/2026-05-28-daemon-sdk-architecture.md](../../daemon/2026-05-28-daemon-sdk-architecture.md).

## File Map

Create:

```text
package.json
package-lock.json
tsconfig.json
vitest.config.ts
.gitignore
.env.example
src/domain/events.ts
src/domain/permissions.ts
src/domain/providers.ts
src/domain/runs.ts
src/domain/auth.ts
src/domain/logging.ts
src/domain/errors.ts
src/application/eventBus.ts
src/application/eventNormalizer.ts
src/application/executionService.ts
src/application/permissionService.ts
src/application/runRegistry.ts
src/ports/agentProvider.ts
src/ports/eventLogger.ts
src/adapters/http/routes.ts
src/adapters/http/server.ts
src/adapters/http/sse.ts
src/adapters/logging/memoryEventLogger.ts
src/adapters/providers/common/actionSchemas.ts
src/adapters/providers/common/providerRegistry.ts
src/adapters/providers/codex/actions.ts
src/adapters/providers/codex/codexAdapter.ts
src/adapters/providers/codex/codexClient.ts
src/adapters/providers/codex/codexNormalizer.ts
src/adapters/providers/claude/actions.ts
src/adapters/providers/claude/claudeAdapter.ts
src/adapters/providers/claude/claudeClient.ts
src/adapters/providers/claude/claudeNormalizer.ts
src/adapters/providers/opencode/actions.ts
src/adapters/providers/opencode/opencodeAdapter.ts
src/adapters/providers/opencode/opencodeClient.ts
src/adapters/providers/opencode/opencodeNormalizer.ts
src/infrastructure/config.ts
src/infrastructure/cli.ts
src/infrastructure/ids.ts
src/infrastructure/redaction.ts
src/infrastructure/time.ts
src/main.ts
scripts/generate-sdk-coverage.ts
tests/fixtures/codexEvents.ts
tests/fixtures/claudeMessages.ts
tests/fixtures/opencodeEvents.ts
tests/unit/domain.test.ts
tests/unit/auth.test.ts
tests/unit/redaction.test.ts
tests/unit/memoryEventLogger.test.ts
tests/unit/eventBus.test.ts
tests/unit/permissionService.test.ts
tests/unit/runRegistry.test.ts
tests/unit/codexNormalizer.test.ts
tests/unit/claudeNormalizer.test.ts
tests/unit/opencodeNormalizer.test.ts
tests/unit/providerActions.test.ts
tests/unit/executionService.test.ts
tests/unit/httpRoutes.test.ts
tests/integration/sse.test.ts
tests/integration/server.test.ts
tests/smoke/realSdk.smoke.test.ts
docs/daemon/running.md
docs/daemon/http-and-sse.md
docs/daemon/providers.md
docs/daemon/events.md
docs/daemon/sdk-coverage.md
```

## SDK Action Coverage Contract

The adapters must expose these action IDs exactly.

OpenCode provider actions:

```text
global.health
app.log
app.agents
config.get
config.providers
path.get
project.list
project.current
auth.set
session.list
session.create
session.get
session.children
session.delete
session.update
session.init
session.share
session.unshare
session.summarize
session.messages
session.message
session.command
session.shell
session.revert
session.unrevert
session.prompt
session.abort
session.permission.reply
find.text
find.files
find.symbols
file.read
file.status
tui.appendPrompt
tui.openHelp
tui.openSessions
tui.openThemes
tui.openModels
tui.submitPrompt
tui.clearPrompt
tui.executeCommand
tui.showToast
```

Codex provider actions:

```text
thread.start
thread.resume
thread.run
thread.runStreamed
turn.cancel
```

Claude provider actions:

```text
query.run
tool.create
mcp.createSdkMcpServer
sessions.list
sessions.messages
sessions.info
sessions.rename
sessions.tag
query.interrupt
query.close
query.initializationResult
query.supportedCommands
query.supportedModels
query.supportedAgents
query.accountInfo
query.rewindFiles
query.setPermissionMode
query.setModel
query.setMaxThinkingTokens
query.mcpServerStatus
query.reconnectMcpServer
query.toggleMcpServer
query.setMcpServers
query.streamInput
query.stopTask
```

---

### Task 1: Project Scaffold and Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create project configuration**

Create `package.json`:

```json
{
  "name": "agent-daemon",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run tests/smoke",
    "coverage": "vitest run --coverage",
    "docs:sdk-coverage": "tsx scripts/generate-sdk-coverage.ts",
    "verify": "npm run build && npm test && npm run docs:sdk-coverage"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "@openai/codex-sdk": "latest",
    "@opencode-ai/sdk": "latest",
    "fastify": "^5.3.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "@vitest/coverage-v8": "^3.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/smoke/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["dist/**", "tests/**", "scripts/**"]
    }
  }
});
```

Create `.gitignore`:

```text
node_modules/
dist/
coverage/
.env
.env.local
*.log
```

Create `.env.example`:

```text
DAEMON_HOST=127.0.0.1
DAEMON_PORT=4317
DAEMON_LOG_LEVEL=info
DAEMON_EVENT_BUFFER_SIZE=1000
ANTHROPIC_API_KEY=
CLAUDE_CODE_OAUTH_TOKEN=
OPENAI_API_KEY=
CODEX_API_KEY=
RUN_REAL_SDK_TESTS=0
OPENCODE_DAEMON_REAL_TEST=0
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
npm install
```

Expected: `package-lock.json` is created and all dependencies install.

- [ ] **Step 3: Verify empty test suite state**

Run:

```powershell
npm test
```

Expected: Vitest runs and reports no test files or an empty suite failure. This is acceptable before Task 2 because no production code exists.

- [ ] **Step 4: Commit scaffold**

Run:

```powershell
git config user.name "josefernando"
git config user.email "fernandoschnneider@gmail.com"
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "chore: scaffold TypeScript daemon project"
```

---

### Task 2: Domain Types, Auth, Errors, IDs, Time, and Redaction

**Files:**
- Create: `src/domain/events.ts`
- Create: `src/domain/permissions.ts`
- Create: `src/domain/providers.ts`
- Create: `src/domain/runs.ts`
- Create: `src/domain/auth.ts`
- Create: `src/domain/logging.ts`
- Create: `src/domain/errors.ts`
- Create: `src/infrastructure/cli.ts`
- Create: `src/infrastructure/ids.ts`
- Create: `src/infrastructure/time.ts`
- Create: `src/infrastructure/redaction.ts`
- Test: `tests/unit/domain.test.ts`
- Test: `tests/unit/auth.test.ts`
- Test: `tests/unit/redaction.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create `tests/unit/domain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDaemonEvent } from "../../src/domain/events.js";
import { createRun } from "../../src/domain/runs.js";

describe("domain model", () => {
  it("creates ordered daemon events with stable envelope fields", () => {
    const event = createDaemonEvent({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started",
      createdAt: "2026-05-28T00:00:00.000Z",
      sequence: 7,
      data: { status: "running" }
    });

    expect(event).toEqual({
      id: "evt_1",
      runId: "run_1",
      provider: "codex",
      type: "run.started",
      createdAt: "2026-05-28T00:00:00.000Z",
      sequence: 7,
      data: { status: "running" }
    });
  });

  it("creates a queued run from a normalized request", () => {
    const run = createRun({
      id: "run_1",
      createdAt: "2026-05-28T00:00:00.000Z",
      provider: "claude",
      prompt: "inspect repo",
      authMode: "auto",
      permissionMode: "normal"
    });

    expect(run.status).toBe("queued");
    expect(run.provider).toBe("claude");
    expect(run.authMode).toBe("auto");
    expect(run.permissionMode).toBe("normal");
  });
});
```

Create `tests/unit/auth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveAuthMode } from "../../src/domain/auth.js";
import { detectCli } from "../../src/infrastructure/cli.js";

describe("auth mode", () => {
  it("defaults run requests to auto auth mode", () => {
    expect(resolveAuthMode(undefined)).toBe("auto");
  });

  it("accepts explicit cli and sdk auth modes", () => {
    expect(resolveAuthMode("cli")).toBe("cli");
    expect(resolveAuthMode("sdk")).toBe("sdk");
  });
});

describe("detectCli", () => {
  it("returns unavailable when a binary cannot be found", async () => {
    const execFile = vi.fn().mockRejectedValue(new Error("not found"));
    await expect(detectCli("missing-cli", execFile)).resolves.toEqual({
      available: false,
      path: null
    });
  });
});
```

Create `tests/unit/redaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../src/infrastructure/redaction.js";

describe("redactSecrets", () => {
  it("redacts common API key fields recursively", () => {
    const redacted = redactSecrets({
      apiKey: "sk-secret",
      env: {
        OPENAI_API_KEY: "openai-secret",
        SAFE_VALUE: "visible"
      },
      nested: [{ token: "abc", cwd: "C:/repo" }]
    });

    expect(redacted).toEqual({
      apiKey: "[REDACTED]",
      env: {
        OPENAI_API_KEY: "[REDACTED]",
        SAFE_VALUE: "visible"
      },
      nested: [{ token: "[REDACTED]", cwd: "C:/repo" }]
    });
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npx vitest run tests/unit/domain.test.ts tests/unit/auth.test.ts tests/unit/redaction.test.ts
```

Expected: FAIL because `src/domain/events.ts`, `src/domain/runs.ts`, `src/domain/auth.ts`, `src/infrastructure/cli.ts`, and `src/infrastructure/redaction.ts` do not exist.

- [ ] **Step 3: Implement domain and utility files**

Create `src/domain/events.ts` with `ProviderId`, `DaemonEventType`, `DaemonEvent`, `createDaemonEvent`, `ProviderRawEvent`, and `ProviderEventSink`.

Create `src/domain/auth.ts` with `AuthMode`, `ProviderAuthStatus`, and `resolveAuthMode`. `resolveAuthMode(undefined)` returns `"auto"` and rejects unknown values by throwing `badRequest`.

Create `src/domain/runs.ts` with `PermissionMode`, `RunStatus`, `ProviderInputPart`, `AgentRunRequest`, `AgentRun`, and `createRun`. `createRun` stores `authMode` and defaults it to `"auto"`.

Create `src/domain/permissions.ts` with `PermissionDecision`, `PermissionScope`, `PermissionRequest`, `PermissionResolution`, and `PendingPermission`.

Create `src/domain/providers.ts` with `ProviderCapabilities`, `SdkActionDescriptor`, `SdkActionResult`, `ProviderSdkActionRequest`, and `RunSdkActionRequest`.

Create `src/domain/logging.ts` with `LogEntry`, `LogLevel`, `LogFilter`, and `LogEventKind`.

Create `src/domain/errors.ts` with `DaemonError`, `badRequest`, `notFound`, `providerFailure`, and `permissionFailure`.

Create `src/infrastructure/ids.ts`:

```ts
import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
```

Create `src/infrastructure/time.ts`:

```ts
export function nowIso(): string {
  return new Date().toISOString();
}
```

Create `src/infrastructure/cli.ts` with `detectCli(binary, execFile = nodeExecFile)` using `where.exe` on Windows and `which` elsewhere. It returns `{ available: boolean; path: string | null }`.

Create `src/infrastructure/redaction.ts` with recursive object and array redaction for keys containing `key`, `token`, `secret`, `password`, or `authorization`.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/domain.test.ts tests/unit/auth.test.ts tests/unit/redaction.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit domain foundation**

Run:

```powershell
git add src/domain src/infrastructure tests/unit/domain.test.ts tests/unit/auth.test.ts tests/unit/redaction.test.ts
git commit -m "feat: add daemon domain contracts auth and redaction"
```

---

### Task 3: Memory Event Logger

**Files:**
- Create: `src/ports/eventLogger.ts`
- Create: `src/adapters/logging/memoryEventLogger.ts`
- Test: `tests/unit/memoryEventLogger.test.ts`

- [ ] **Step 1: Write failing logger tests**

Create `tests/unit/memoryEventLogger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MemoryEventLogger } from "../../src/adapters/logging/memoryEventLogger.js";

describe("MemoryEventLogger", () => {
  it("stores redacted log entries in insertion order", async () => {
    const logger = new MemoryEventLogger({ maxEntries: 10, echoToConsole: false });

    await logger.log({
      id: "log_1",
      createdAt: "2026-05-28T00:00:00.000Z",
      level: "info",
      kind: "request.input",
      message: "run requested",
      data: { apiKey: "secret", prompt: "hello" }
    });

    expect(await logger.list()).toEqual([
      expect.objectContaining({
        data: { apiKey: "[REDACTED]", prompt: "hello" }
      })
    ]);
  });

  it("keeps only the configured number of entries", async () => {
    const logger = new MemoryEventLogger({ maxEntries: 1, echoToConsole: false });
    await logger.log({ id: "log_1", createdAt: "a", level: "info", kind: "event.raw", message: "first" });
    await logger.log({ id: "log_2", createdAt: "b", level: "info", kind: "event.raw", message: "second" });

    expect((await logger.list()).map((entry) => entry.id)).toEqual(["log_2"]);
  });
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/memoryEventLogger.test.ts
```

Expected: FAIL because `MemoryEventLogger` does not exist.

- [ ] **Step 3: Implement logger port and adapter**

Create `src/ports/eventLogger.ts`:

```ts
import type { LogEntry, LogFilter } from "../domain/logging.js";

export interface EventLogger {
  log(entry: LogEntry): Promise<void>;
  list(filter?: LogFilter): Promise<LogEntry[]>;
}
```

Create `src/adapters/logging/memoryEventLogger.ts` with constructor `{ maxEntries, echoToConsole }`, redaction through `redactSecrets`, bounded storage, and filtering by `level`, `kind`, `runId`, and `provider`.

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/unit/memoryEventLogger.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit logger**

Run:

```powershell
git add src/ports/eventLogger.ts src/adapters/logging/memoryEventLogger.ts tests/unit/memoryEventLogger.test.ts
git commit -m "feat: add centralized memory event logger"
```

---

### Task 4: Event Bus with Replay and SSE Framing

**Files:**
- Create: `src/application/eventBus.ts`
- Create: `src/adapters/http/sse.ts`
- Test: `tests/unit/eventBus.test.ts`

- [ ] **Step 1: Write failing event bus tests**

Create `tests/unit/eventBus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/application/eventBus.js";
import { encodeSseFrame } from "../../src/adapters/http/sse.js";

describe("EventBus", () => {
  it("replays prior run events before live events", () => {
    const bus = new EventBus({ bufferSize: 5 });
    bus.publish({ id: "evt_1", runId: "run_1", provider: "codex", type: "run.created", createdAt: "a", sequence: 1, data: {} });
    bus.publish({ id: "evt_2", runId: "run_2", provider: "claude", type: "run.created", createdAt: "b", sequence: 1, data: {} });

    expect(bus.replay("run_1").map((event) => event.id)).toEqual(["evt_1"]);
  });

  it("encodes SSE frames with id, event, and JSON data", () => {
    const frame = encodeSseFrame({
      id: "evt_1",
      runId: "run_1",
      provider: "opencode",
      type: "message.delta",
      createdAt: "now",
      sequence: 2,
      data: { text: "hi" }
    });

    expect(frame).toContain("id: evt_1\n");
    expect(frame).toContain("event: message.delta\n");
    expect(frame).toContain('"text":"hi"');
  });
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/eventBus.test.ts
```

Expected: FAIL because `EventBus` and `encodeSseFrame` do not exist.

- [ ] **Step 3: Implement event bus and SSE framing**

Implement `EventBus` with:

- bounded global event list;
- per-run replay filtering;
- `subscribe(runId | "all", listener)` returning an unsubscribe function;
- sequence preservation;
- synchronous delivery for in-process subscribers.

Implement `encodeSseFrame(event)` as `id`, `event`, `data`, blank line.

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/unit/eventBus.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit event bus**

Run:

```powershell
git add src/application/eventBus.ts src/adapters/http/sse.ts tests/unit/eventBus.test.ts
git commit -m "feat: add event bus and SSE framing"
```

---

### Task 5: Run Registry and Permission Service

**Files:**
- Create: `src/application/runRegistry.ts`
- Create: `src/application/permissionService.ts`
- Test: `tests/unit/runRegistry.test.ts`
- Test: `tests/unit/permissionService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/runRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RunRegistry } from "../../src/application/runRegistry.js";

describe("RunRegistry", () => {
  it("stores runs and active handles by run id", () => {
    const registry = new RunRegistry();
    registry.addRun({ id: "run_1", provider: "codex", prompt: "hi", permissionMode: "normal", status: "queued", createdAt: "now", updatedAt: "now" });
    registry.setHandle("run_1", { provider: "codex", native: { id: "thread_1" } });

    expect(registry.getRun("run_1")?.status).toBe("queued");
    expect(registry.getHandle("run_1")?.provider).toBe("codex");
  });
});
```

Create `tests/unit/permissionService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PermissionService } from "../../src/application/permissionService.js";

describe("PermissionService", () => {
  it("creates a pending permission and resolves it once", async () => {
    const service = new PermissionService();
    const pending = service.createPending({
      permissionId: "perm_1",
      runId: "run_1",
      provider: "claude",
      toolName: "Bash",
      toolInput: { command: "pwd" },
      createdAt: "now"
    });

    service.resolve("run_1", "perm_1", { decision: "allow", scope: "once" });

    await expect(pending.promise).resolves.toEqual({ decision: "allow", scope: "once" });
    expect(service.getPending("run_1", "perm_1")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npx vitest run tests/unit/runRegistry.test.ts tests/unit/permissionService.test.ts
```

Expected: FAIL because registry and permission service do not exist.

- [ ] **Step 3: Implement registry and permission service**

Implement:

- `RunRegistry.addRun`, `getRun`, `listRuns`, `updateRun`, `setHandle`, `getHandle`, `removeHandle`;
- `PermissionService.createPending`, `getPending`, `resolve`, `rejectAllForRun`.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/runRegistry.test.ts tests/unit/permissionService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit registry and permissions**

Run:

```powershell
git add src/application/runRegistry.ts src/application/permissionService.ts tests/unit/runRegistry.test.ts tests/unit/permissionService.test.ts
git commit -m "feat: add run registry and permission service"
```

---

### Task 6: Provider Action Descriptors and Coverage Tests

**Files:**
- Create: `src/adapters/providers/common/actionSchemas.ts`
- Create: `src/adapters/providers/opencode/actions.ts`
- Create: `src/adapters/providers/codex/actions.ts`
- Create: `src/adapters/providers/claude/actions.ts`
- Test: `tests/unit/providerActions.test.ts`

- [ ] **Step 1: Write failing action coverage tests**

Create `tests/unit/providerActions.test.ts` with exact action ID expectations:

```ts
import { describe, expect, it } from "vitest";
import { opencodeActions } from "../../src/adapters/providers/opencode/actions.js";
import { codexActions } from "../../src/adapters/providers/codex/actions.js";
import { claudeActions } from "../../src/adapters/providers/claude/actions.js";

const opencodeActionIds = [
  "global.health", "app.log", "app.agents", "config.get", "config.providers", "path.get",
  "project.list", "project.current", "auth.set", "session.list", "session.create", "session.get",
  "session.children", "session.delete", "session.update", "session.init", "session.share",
  "session.unshare", "session.summarize", "session.messages", "session.message",
  "session.command", "session.shell", "session.revert", "session.unrevert", "session.prompt",
  "session.abort", "session.permission.reply", "find.text", "find.files", "find.symbols",
  "file.read", "file.status", "tui.appendPrompt", "tui.openHelp", "tui.openSessions",
  "tui.openThemes", "tui.openModels", "tui.submitPrompt", "tui.clearPrompt",
  "tui.executeCommand", "tui.showToast"
];

const codexActionIds = ["thread.start", "thread.resume", "thread.run", "thread.runStreamed", "turn.cancel"];

const claudeActionIds = [
  "query.run", "tool.create", "mcp.createSdkMcpServer", "sessions.list", "sessions.messages",
  "sessions.info", "sessions.rename", "sessions.tag", "query.interrupt", "query.close",
  "query.initializationResult", "query.supportedCommands", "query.supportedModels",
  "query.supportedAgents", "query.accountInfo", "query.rewindFiles", "query.setPermissionMode",
  "query.setModel", "query.setMaxThinkingTokens", "query.mcpServerStatus",
  "query.reconnectMcpServer", "query.toggleMcpServer", "query.setMcpServers",
  "query.streamInput", "query.stopTask"
];

describe("provider action descriptors", () => {
  it("registers every OpenCode SDK action", () => {
    expect(opencodeActions.map((action) => action.id)).toEqual(opencodeActionIds);
  });

  it("registers every Codex SDK action", () => {
    expect(codexActions.map((action) => action.id)).toEqual(codexActionIds);
  });

  it("registers every Claude SDK action", () => {
    expect(claudeActions.map((action) => action.id)).toEqual(claudeActionIds);
  });

  it("uses only provider or run scopes", () => {
    const all = [...opencodeActions, ...codexActions, ...claudeActions];
    expect(all.every((action) => action.scope === "provider" || action.scope === "run")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: FAIL because action descriptor files do not exist.

- [ ] **Step 3: Implement descriptors**

Implement `actionDescriptor(id, provider, scope, sideEffects, streaming)` helper in `src/adapters/providers/common/actionSchemas.ts`.

Implement exact arrays in each provider `actions.ts`. Each descriptor must include `id`, `provider`, `scope`, `description`, `inputSchema`, `outputSchema`, `streaming`, and `sideEffects`.

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit action descriptors**

Run:

```powershell
git add src/adapters/providers/common/actionSchemas.ts src/adapters/providers/*/actions.ts tests/unit/providerActions.test.ts
git commit -m "feat: enumerate full provider SDK action coverage"
```

---

### Task 7: Provider Raw Event Fixtures and Normalizers

**Files:**
- Create: `tests/fixtures/codexEvents.ts`
- Create: `tests/fixtures/claudeMessages.ts`
- Create: `tests/fixtures/opencodeEvents.ts`
- Create: `src/application/eventNormalizer.ts`
- Create: `src/adapters/providers/codex/codexNormalizer.ts`
- Create: `src/adapters/providers/claude/claudeNormalizer.ts`
- Create: `src/adapters/providers/opencode/opencodeNormalizer.ts`
- Test: `tests/unit/codexNormalizer.test.ts`
- Test: `tests/unit/claudeNormalizer.test.ts`
- Test: `tests/unit/opencodeNormalizer.test.ts`

- [ ] **Step 1: Write failing Codex normalizer tests**

Cover these Codex event types: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.started`, `item.updated`, `item.completed`, `error`.

Use fixtures for item types: `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `todo_list`, `error`.

Expected mappings:

```text
thread.started -> session.discovered
turn.started -> run.started
turn.completed -> usage.updated, run.completed
turn.failed -> run.failed
agent_message -> message.started, message.delta, message.completed
reasoning -> reasoning.started, reasoning.delta, reasoning.completed
command_execution -> tool.started, tool.delta, tool.completed, tool.failed
file_change -> file.changed
mcp_tool_call -> tool.started, tool.completed
web_search -> tool.started, tool.completed
todo_list -> todo.updated
error item -> tool.failed or run.failed
unknown -> unknown
```

- [ ] **Step 2: Write failing Claude normalizer tests**

Cover message types: `assistant`, `user`, `result`, `system`, `stream_event`, `compact_boundary`, `status`, `local_command_output`, `hook_started`, `hook_progress`, `hook_response`, `tool_progress`, `auth_status`, `task_notification`, `task_started`, `task_progress`, `files_persisted`, `tool_use_summary`, `rate_limit`, `prompt_suggestion`.

Cover hook names: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`, `Setup`, `TeammateIdle`, `TaskCompleted`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`.

Expected mappings follow the spec: assistant text to messages, tool use/result to tool events, result success/error to run terminal events, permission-related messages to permission events, task/todo families to `todo.updated`, and unknown message types to `unknown`.

- [ ] **Step 3: Write failing OpenCode normalizer tests**

Cover OpenCode raw event classes:

```text
session lifecycle
message lifecycle
part text delta
tool start
tool update
tool finish
permission request
permission reply
file status update
error
tokens/cost
child session
unknown
```

Expected mappings: preserve `provider.raw` for every event and emit normalized `message`, `tool`, `permission`, `file`, `usage`, `session`, `run.failed`, or `unknown` events.

- [ ] **Step 4: Run tests to verify red**

Run:

```powershell
npx vitest run tests/unit/codexNormalizer.test.ts tests/unit/claudeNormalizer.test.ts tests/unit/opencodeNormalizer.test.ts
```

Expected: FAIL because normalizers and fixtures do not exist.

- [ ] **Step 5: Implement pure normalizers**

Each provider normalizer exports:

```ts
export function normalizeCodexEvent(input: NormalizeInput): DaemonEvent[];
export function normalizeClaudeMessage(input: NormalizeInput): DaemonEvent[];
export function normalizeOpenCodeEvent(input: NormalizeInput): DaemonEvent[];
```

`src/application/eventNormalizer.ts` dispatches by provider and raw event shape. Every normalization function must return at least one daemon event.

- [ ] **Step 6: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/codexNormalizer.test.ts tests/unit/claudeNormalizer.test.ts tests/unit/opencodeNormalizer.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit normalizers**

Run:

```powershell
git add src/application/eventNormalizer.ts src/adapters/providers/*/*Normalizer.ts tests/fixtures tests/unit/*Normalizer.test.ts
git commit -m "feat: normalize raw SDK events for all providers"
```

---

### Task 8: Provider Registry and AgentProvider Port

**Files:**
- Create: `src/ports/agentProvider.ts`
- Create: `src/adapters/providers/common/providerRegistry.ts`
- Test: extend `tests/unit/providerActions.test.ts`

- [ ] **Step 1: Write failing registry tests**

Add tests that:

- register three providers;
- reject duplicate IDs;
- return action descriptors per provider;
- return auth status per provider;
- execute only registered action IDs;
- throw `DaemonError` for unknown provider or action.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: FAIL because registry and port do not exist.

- [ ] **Step 3: Implement port and registry**

`AgentProvider` must include `getCapabilities`, `getAuthStatus`, `listActions`, `executeProviderAction`, `executeRunAction`, `startRun`, `resumeRun`, `cancelRun`, and `resolvePermission`.

`ProviderRegistry` must expose `register`, `get`, `list`, `authStatusFor`, `actionsFor`, `executeProviderAction`, and `executeRunAction`.

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit registry**

Run:

```powershell
git add src/ports/agentProvider.ts src/adapters/providers/common/providerRegistry.ts tests/unit/providerActions.test.ts
git commit -m "feat: add provider registry and action dispatch contract"
```

---

### Task 9: Codex Adapter with Full Action Dispatch

**Files:**
- Create: `src/adapters/providers/codex/codexClient.ts`
- Create: `src/adapters/providers/codex/codexAdapter.ts`
- Test: extend `tests/unit/providerActions.test.ts`
- Test: extend `tests/unit/codexNormalizer.test.ts`

- [ ] **Step 1: Write failing Codex adapter tests**

Use an injected fake SDK factory. Assert that:

- `getCapabilities()` includes every Codex action ID;
- `thread.start` calls `codex.startThread`;
- `thread.resume` calls `codex.resumeThread`;
- `thread.run` calls buffered `thread.run`;
- `thread.runStreamed` calls `thread.runStreamed` and forwards every raw event to the sink;
- `turn.cancel` aborts the active `AbortController`;
- `getAuthStatus()` reports CLI auth when `codex` is present and login status can be detected;
- `authMode: "auto"` selects CLI/local auth before SDK/API-key auth;
- `authMode: "cli"` fails with `provider.auth_required` when Codex CLI auth is unavailable;
- `authMode: "sdk"` uses explicit SDK/API-key environment credentials only;
- run input maps `cwd`, `model`, `modelReasoningEffort`, `approvalPolicy`, `sandboxMode`, `networkAccessEnabled`, `webSearchMode`, `webSearchEnabled`, `skipGitRepoCheck`, `additionalDirectories`, `outputSchema`, `env`, and multimodal prompt input.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/codexNormalizer.test.ts
```

Expected: FAIL because Codex adapter does not exist.

- [ ] **Step 3: Implement Codex client wrapper**

`codexClient.ts` exports:

```ts
export type CodexSdkFactory = (options: CodexFactoryOptions) => CodexSdkClient;
export function createRealCodexFactory(): CodexSdkFactory;
```

The real factory imports `Codex` from `@openai/codex-sdk`.

- [ ] **Step 4: Implement Codex adapter**

`CodexAdapter` must:

- expose all action descriptors from `codexActions`;
- keep active thread and abort handles by daemon run ID;
- detect `codex` CLI availability and local login status for `authMode: "auto"` and `authMode: "cli"`;
- prefer CLI/local credentials in `authMode: "auto"`;
- use SDK/API env credentials only in `authMode: "sdk"` or as fallback when `authMode: "auto"` has no CLI credentials;
- map `permissionMode: "normal"` to `approvalPolicy: "on-request"` and safe sandbox;
- map `permissionMode: "yolo"` to `approvalPolicy: "never"` and `sandboxMode: "danger-full-access"`;
- emit provider warnings for permission callback limitations;
- stream raw events and normalized events through the sink.

- [ ] **Step 5: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/codexNormalizer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Codex adapter**

Run:

```powershell
git add src/adapters/providers/codex tests/unit/providerActions.test.ts tests/unit/codexNormalizer.test.ts
git commit -m "feat: implement full Codex SDK adapter coverage"
```

---

### Task 10: Claude Adapter with Full Action Dispatch

**Files:**
- Create: `src/adapters/providers/claude/claudeClient.ts`
- Create: `src/adapters/providers/claude/claudeAdapter.ts`
- Test: extend `tests/unit/providerActions.test.ts`
- Test: extend `tests/unit/claudeNormalizer.test.ts`

- [ ] **Step 1: Write failing Claude adapter tests**

Use injected fake SDK functions for `query`, `tool`, `createSdkMcpServer`, `listSessions`, `getSessionMessages`, `getSessionInfo`, `renameSession`, and `tagSession`.

Assert that:

- `getCapabilities()` includes every Claude action ID;
- `query.run` and `startRun` call `query`;
- async SDK messages are forwarded to the sink;
- `includePartialMessages`, `permissionMode`, `allowedTools`, `disallowedTools`, `canUseTool`, `abortController`, `cwd`, `model`, `maxTurns`, `mcpServers`, and `agents` are mapped;
- `permissionMode: "normal"` creates daemon permission requests through `canUseTool`;
- `permissionMode: "yolo"` maps to `bypassPermissions`;
- run-bound query actions call the active Query methods listed in the action coverage contract;
- provider-level session actions call the matching SDK functions.
- `getAuthStatus()` reports Claude Code local auth when `claude` is present and status can be detected;
- `authMode: "auto"` selects Claude Code/local Agent SDK auth before explicit API-key auth;
- `authMode: "cli"` fails with `provider.auth_required` when local Claude auth is unavailable;
- `authMode: "sdk"` uses `ANTHROPIC_API_KEY`, Workload Identity Federation, cloud-provider auth, or explicit token env only.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/claudeNormalizer.test.ts
```

Expected: FAIL because Claude adapter does not exist.

- [ ] **Step 3: Implement Claude client wrapper**

`claudeClient.ts` exports:

```ts
export type ClaudeSdkFacade = {
  query: typeof import("@anthropic-ai/claude-agent-sdk").query;
  tool: typeof import("@anthropic-ai/claude-agent-sdk").tool;
  createSdkMcpServer: typeof import("@anthropic-ai/claude-agent-sdk").createSdkMcpServer;
  listSessions: typeof import("@anthropic-ai/claude-agent-sdk").listSessions;
  getSessionMessages: typeof import("@anthropic-ai/claude-agent-sdk").getSessionMessages;
  getSessionInfo: typeof import("@anthropic-ai/claude-agent-sdk").getSessionInfo;
  renameSession: typeof import("@anthropic-ai/claude-agent-sdk").renameSession;
  tagSession: typeof import("@anthropic-ai/claude-agent-sdk").tagSession;
};
```

The real facade imports these functions from `@anthropic-ai/claude-agent-sdk`.

- [ ] **Step 4: Implement Claude adapter**

`ClaudeAdapter` must:

- expose all action descriptors from `claudeActions`;
- keep active Query handles by daemon run ID;
- detect `claude` CLI availability and local auth status;
- prefer Claude Code/local Agent SDK credentials in `authMode: "auto"` when permitted by the user's use case;
- use explicit SDK/API credentials only in `authMode: "sdk"` or as fallback when `authMode: "auto"` has no local credentials;
- surface Anthropic legal/compliance caveats in capability metadata rather than silently routing subscription credentials for productized third-party usage;
- implement provider-level session/tool/MCP actions;
- implement run-bound Query method actions;
- convert `canUseTool` requests into daemon pending permission requests and return SDK `PermissionResult`;
- route `Query.close()` and `AbortController.abort()` through cancel.

- [ ] **Step 5: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/claudeNormalizer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Claude adapter**

Run:

```powershell
git add src/adapters/providers/claude tests/unit/providerActions.test.ts tests/unit/claudeNormalizer.test.ts
git commit -m "feat: implement full Claude Agent SDK adapter coverage"
```

---

### Task 11: OpenCode Adapter with Full Action Dispatch

**Files:**
- Create: `src/adapters/providers/opencode/opencodeClient.ts`
- Create: `src/adapters/providers/opencode/opencodeAdapter.ts`
- Test: extend `tests/unit/providerActions.test.ts`
- Test: extend `tests/unit/opencodeNormalizer.test.ts`

- [ ] **Step 1: Write failing OpenCode adapter tests**

Use an injected fake OpenCode client with nested members for `global`, `app`, `config`, `path`, `project`, `auth`, `session`, `find`, `file`, `tui`, and `event`.

Assert that:

- `getCapabilities()` includes every OpenCode action ID;
- every action ID calls the matching nested SDK method;
- `getAuthStatus()` reports OpenCode server/config auth from `opencode serve`, `/connect`, `auth.json`, local providers, or provider env metadata;
- `authMode: "auto"` connects to OpenCode's local server/config before attempting SDK/API-key style credentials;
- `authMode: "cli"` fails with `provider.auth_required` when OpenCode local server/config auth is unavailable;
- `authMode: "sdk"` uses only explicit provider env/config passed to the SDK client;
- `startRun` creates or reuses a session, calls `session.prompt`, and subscribes through `event.subscribe`;
- every subscribed event is emitted raw and normalized;
- `session.permission.reply` calls `postSessionByIdPermissionsByPermissionId` or the generated equivalent;
- `cancelRun` calls `session.abort`;
- `yolo` mode maps to allow permissions where OpenCode rules support it;
- TUI actions are available through actions but marked with side effect `provider`.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/opencodeNormalizer.test.ts
```

Expected: FAIL because OpenCode adapter does not exist.

- [ ] **Step 3: Implement OpenCode client wrapper**

`opencodeClient.ts` exports:

```ts
export type OpenCodeSdkFactory = (options: OpenCodeFactoryOptions) => Promise<OpenCodeSdkClient>;
export function createRealOpenCodeFactory(): OpenCodeSdkFactory;
```

The real factory imports `createOpencode` and `createOpencodeClient` from `@opencode-ai/sdk`.

- [ ] **Step 4: Implement OpenCode adapter**

`OpenCodeAdapter` must:

- expose all action descriptors from `opencodeActions`;
- route action IDs through an explicit `switch`;
- prefer `opencode serve` and `createOpencodeClient()` in `authMode: "auto"` and `authMode: "cli"`;
- use `createOpencode()` direct/server mode only when explicitly configured or when local server startup is owned by the daemon;
- report OpenCode provider auth sources without reading or logging secret values from `auth.json`;
- store OpenCode session IDs by daemon run ID;
- subscribe to raw events per run;
- map daemon permission resolutions to OpenCode permission reply calls;
- forward `env` overrides only where the SDK supports them;
- emit a capability limitation when a requested behavior has no OpenCode SDK equivalent.

- [ ] **Step 5: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts tests/unit/opencodeNormalizer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit OpenCode adapter**

Run:

```powershell
git add src/adapters/providers/opencode tests/unit/providerActions.test.ts tests/unit/opencodeNormalizer.test.ts
git commit -m "feat: implement full OpenCode SDK adapter coverage"
```

---

### Task 12: Execution Service Orchestration

**Files:**
- Create: `src/application/executionService.ts`
- Test: `tests/unit/executionService.test.ts`

- [ ] **Step 1: Write failing execution service tests**

Test:

- `startRun` logs request input;
- creates run and emits `run.created`;
- calls provider `startRun`;
- stores provider handle;
- emits raw and normalized events;
- updates terminal status on completed, failed, or cancelled;
- `resumeRun` calls provider `resumeRun`;
- `cancelRun` calls provider `cancelRun`;
- `resolvePermission` updates `PermissionService` and provider adapter.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/executionService.test.ts
```

Expected: FAIL because `ExecutionService` does not exist.

- [ ] **Step 3: Implement execution service**

Constructor dependencies:

```ts
type ExecutionServiceDeps = {
  providers: ProviderRegistry;
  runs: RunRegistry;
  permissions: PermissionService;
  events: EventBus;
  logger: EventLogger;
  createId: (prefix: string) => string;
  now: () => string;
};
```

Methods:

```ts
startRun(request: AgentRunRequest): Promise<AgentRun>;
resumeRun(runId: string, input: ProviderResumeInput): Promise<AgentRun>;
cancelRun(runId: string): Promise<AgentRun>;
resolvePermission(runId: string, permissionId: string, resolution: PermissionResolution): Promise<void>;
executeProviderAction(provider: ProviderId, request: ProviderSdkActionRequest): Promise<SdkActionResult>;
executeRunAction(runId: string, request: RunSdkActionRequest): Promise<SdkActionResult>;
```

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/unit/executionService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit execution service**

Run:

```powershell
git add src/application/executionService.ts tests/unit/executionService.test.ts
git commit -m "feat: orchestrate runs, actions, events, and permissions"
```

---

### Task 13: HTTP Server, Validation, and Routes

**Files:**
- Create: `src/adapters/http/server.ts`
- Create: `src/adapters/http/routes.ts`
- Create: `src/infrastructure/config.ts`
- Test: `tests/unit/httpRoutes.test.ts`
- Test: `tests/integration/server.test.ts`

- [ ] **Step 1: Write failing HTTP tests**

Test with Fastify injection:

- `GET /health`;
- `GET /providers`;
- `GET /providers` includes auth metadata for each provider: `mode`, `available`, `source`, and `requiresApiKey`;
- `GET /providers/:provider/actions`;
- `POST /providers/:provider/actions`;
- `POST /runs`;
- `POST /runs/:provider`;
- `GET /runs`;
- `GET /runs/:runId`;
- `GET /runs/:runId/events` route registration;
- `GET /events` route registration;
- `POST /runs/:runId/cancel`;
- `POST /runs/:runId/permissions/:permissionId`;
- `POST /runs/:runId/resume`;
- `POST /runs/:runId/actions`;
- invalid provider returns 404;
- invalid request body returns 400.
- `POST /runs` defaults missing `authMode` to `"auto"`.

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npx vitest run tests/unit/httpRoutes.test.ts tests/integration/server.test.ts
```

Expected: FAIL because HTTP adapter does not exist.

- [ ] **Step 3: Implement config and routes**

Use Zod schemas for request bodies. Every route delegates to `ExecutionService`, `ProviderRegistry`, `RunRegistry`, `EventBus`, or `EventLogger`.

`createServer(deps)` returns a Fastify instance without listening. `src/main.ts` will listen.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
npx vitest run tests/unit/httpRoutes.test.ts tests/integration/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit HTTP routes**

Run:

```powershell
git add src/adapters/http src/infrastructure/config.ts tests/unit/httpRoutes.test.ts tests/integration/server.test.ts
git commit -m "feat: expose daemon HTTP API"
```

---

### Task 14: SSE Integration

**Files:**
- Modify: `src/adapters/http/routes.ts`
- Modify: `src/adapters/http/sse.ts`
- Test: `tests/integration/sse.test.ts`

- [ ] **Step 1: Write failing SSE integration tests**

Start the Fastify server on an ephemeral port. Test:

- `GET /runs/:runId/events` returns `text/event-stream`;
- prior events are replayed;
- live events are delivered;
- `GET /events` receives all runs;
- disconnect removes the subscriber.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/integration/sse.test.ts
```

Expected: FAIL because live SSE streaming is not implemented.

- [ ] **Step 3: Implement SSE route behavior**

Use Fastify raw reply:

- set `Content-Type: text/event-stream`;
- set `Cache-Control: no-cache`;
- set `Connection: keep-alive`;
- write replay frames first;
- subscribe to bus for live frames;
- unsubscribe on request close;
- send heartbeat comments every 15 seconds.

- [ ] **Step 4: Run test to verify green**

Run:

```powershell
npx vitest run tests/integration/sse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit SSE**

Run:

```powershell
git add src/adapters/http tests/integration/sse.test.ts
git commit -m "feat: stream run and global events over SSE"
```

---

### Task 15: Main Composition Root

**Files:**
- Create: `src/main.ts`
- Modify: `src/adapters/providers/common/providerRegistry.ts`
- Test: `tests/integration/server.test.ts`

- [ ] **Step 1: Write failing composition test**

Add a test that imports `buildDaemon()` and asserts it returns server, services, registry, logger, and event bus with three providers registered.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/integration/server.test.ts
```

Expected: FAIL because composition root does not exist.

- [ ] **Step 3: Implement composition root**

`main.ts` exports:

```ts
export function buildDaemon(overrides?: Partial<DaemonDeps>): DaemonRuntime;
export async function startDaemon(): Promise<void>;
```

It creates real SDK provider adapters, `MemoryEventLogger`, `EventBus`, `RunRegistry`, `PermissionService`, `ExecutionService`, and Fastify server.

- [ ] **Step 4: Run build and tests**

Run:

```powershell
npm run build
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit composition root**

Run:

```powershell
git add src/main.ts src/adapters/providers/common/providerRegistry.ts tests/integration/server.test.ts
git commit -m "feat: wire daemon composition root"
```

---

### Task 16: SDK Coverage Documentation Generator

**Files:**
- Create: `scripts/generate-sdk-coverage.ts`
- Create: `docs/daemon/sdk-coverage.md`
- Test: extend `tests/unit/providerActions.test.ts`

- [ ] **Step 1: Write failing generator test**

Test that every descriptor from `opencodeActions`, `codexActions`, and `claudeActions` appears in generated markdown text.

- [ ] **Step 2: Run test to verify red**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: FAIL because generator does not exist.

- [ ] **Step 3: Implement generator**

`scripts/generate-sdk-coverage.ts` imports action arrays and normalizer known event lists, writes `docs/daemon/sdk-coverage.md` with:

- package names;
- action tables;
- event mapping tables;
- permission mapping;
- limitations;
- real smoke test env requirements.

- [ ] **Step 4: Run generator**

Run:

```powershell
npm run docs:sdk-coverage
```

Expected: `docs/daemon/sdk-coverage.md` is created.

- [ ] **Step 5: Run tests**

Run:

```powershell
npx vitest run tests/unit/providerActions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit generator and coverage docs**

Run:

```powershell
git add scripts/generate-sdk-coverage.ts docs/daemon/sdk-coverage.md tests/unit/providerActions.test.ts
git commit -m "docs: generate SDK coverage matrix from action registry"
```

---

### Task 17: Operator Documentation

**Files:**
- Create: `docs/daemon/running.md`
- Create: `docs/daemon/http-and-sse.md`
- Create: `docs/daemon/providers.md`
- Create: `docs/daemon/events.md`

- [ ] **Step 1: Write documentation**

`running.md` must include:

- Node version;
- `npm install`;
- `.env.example`;
- `npm run dev`;
- `npm run build`;
- `npm start`;
- `npm test`;
- opt-in smoke tests.
- CLI-auth-first setup:
  - authenticate Claude through `claude`;
  - authenticate Codex through `codex --login`;
  - authenticate OpenCode through `/connect`, local providers, or `opencode serve`;
  - explain that API keys are optional fallback credentials.

`http-and-sse.md` must include curl examples for:

- health;
- start run;
- per-run SSE;
- global SSE;
- provider action;
- run action;
- permission resolution;
- cancel.

`providers.md` must include:

- OpenCode adapter behavior;
- Codex adapter behavior;
- Claude adapter behavior;
- `normal` and `yolo` permission mapping;
- known limitations surfaced as capabilities.
- `authMode: "auto" | "cli" | "sdk"` behavior.
- Provider auth detection and fallback behavior.

`events.md` must include:

- daemon event envelope;
- normalized event list;
- provider raw event preservation;
- provider-to-daemon mapping tables.

- [ ] **Step 2: Verify docs are linked**

Run:

```powershell
rg -n "running.md|http-and-sse.md|providers.md|events.md|sdk-coverage.md" docs\\daemon
```

Expected: all five docs are referenced from at least one daemon doc.

- [ ] **Step 3: Commit docs**

Run:

```powershell
git add docs/daemon/running.md docs/daemon/http-and-sse.md docs/daemon/providers.md docs/daemon/events.md
git commit -m "docs: add daemon operation and API guides"
```

---

### Task 18: Real SDK Smoke Tests

**Files:**
- Create: `tests/smoke/realSdk.smoke.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Write opt-in smoke tests**

Smoke tests must skip unless `RUN_REAL_SDK_TESTS=1`.

Cover:

- `GET /providers` with real adapters constructed;
- Claude auth status without requiring an API key when local Claude Code auth is detected;
- Claude minimal query when `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, or permitted local Claude Code auth is present;
- Codex auth status without requiring an API key when Codex CLI login is detected;
- Codex minimal streamed run when `OPENAI_API_KEY`, `CODEX_API_KEY`, or Codex CLI login is present;
- OpenCode health/config when `OPENCODE_DAEMON_REAL_TEST=1`, preferring existing OpenCode server/config auth.

- [ ] **Step 2: Run smoke test default**

Run:

```powershell
npm run test:smoke
```

Expected: PASS with real network tests skipped.

- [ ] **Step 3: Commit smoke tests**

Run:

```powershell
git add tests/smoke/realSdk.smoke.test.ts vitest.config.ts
git commit -m "test: add opt-in real SDK smoke tests"
```

---

### Task 19: Final Verification

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Verify author identity**

Run:

```powershell
git config user.name
git config user.email
```

Expected:

```text
josefernando
fernandoschnneider@gmail.com
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run verify
```

Expected: TypeScript build passes, all non-smoke tests pass, and SDK coverage docs regenerate cleanly.

- [ ] **Step 3: Confirm clean status**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 4: Report result**

Report:

- final test command output summary;
- local server command;
- main endpoints;
- any SDK limitation surfaced as capability metadata.

## Self-Review

Spec coverage:

- HTTP server: Tasks 13 and 15.
- SSE: Tasks 4 and 14.
- CLI-auth-first provider access: Tasks 2, 8, 9, 10, 11, 13, 17, and 18.
- Event normalization: Task 7.
- Centralized logging: Task 3 and Task 12.
- Permission protocol: Task 5, Task 10, Task 11, Task 12, and Task 13.
- OpenCode full SDK action coverage: Tasks 6 and 11.
- Codex full SDK action coverage: Tasks 6 and 9.
- Claude full SDK action coverage: Tasks 6 and 10.
- SDK action endpoints: Tasks 8, 12, and 13.
- Documentation: Tasks 16 and 17.
- Real SDK smoke tests: Task 18.

Placeholder scan:

- The plan contains no placeholder sections and no unassigned behavior. Every action ID listed in the coverage contract is tested through descriptor coverage and dispatch tests.

Type consistency:

- Provider IDs are `opencode`, `codex`, and `claude`.
- Auth modes are `auto`, `cli`, and `sdk`.
- Permission modes are `normal` and `yolo`.
- Public SDK action endpoints are `POST /providers/:provider/actions` and `POST /runs/:runId/actions`.
- Run lifecycle endpoints are `POST /runs`, `POST /runs/:provider`, `POST /runs/:runId/resume`, `POST /runs/:runId/cancel`, and `POST /runs/:runId/permissions/:permissionId`.
