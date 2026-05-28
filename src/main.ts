import { createServer } from "./adapters/http/server.js";
import type { ServerDeps } from "./adapters/http/routes.js";
import { ProviderRegistry } from "./adapters/providers/common/providerRegistry.js";
import type { OpenCodeSdkFactory } from "./adapters/providers/opencode/opencodeClient.js";
import type { ClaudeSdkFacade } from "./adapters/providers/claude/claudeClient.js";
import type { CodexSdkFactory } from "./adapters/providers/codex/codexClient.js";
import { OpenCodeAdapter } from "./adapters/providers/opencode/opencodeAdapter.js";
import { ClaudeAdapter } from "./adapters/providers/claude/claudeAdapter.js";
import { CodexAdapter } from "./adapters/providers/codex/codexAdapter.js";
import { MemoryEventLogger } from "./adapters/logging/memoryEventLogger.js";
import { EventBus } from "./application/eventBus.js";
import { RunRegistry } from "./application/runRegistry.js";
import { PermissionService } from "./application/permissionService.js";
import { ExecutionService } from "./application/executionService.js";
import { loadConfig, type DaemonConfig } from "./infrastructure/config.js";
import { createId } from "./infrastructure/ids.js";
import { nowIso } from "./infrastructure/time.js";

import "./adapters/providers/opencode/opencodeNormalizer.js";
import "./adapters/providers/claude/claudeNormalizer.js";
import "./adapters/providers/codex/codexNormalizer.js";

export interface DaemonDeps {
  config: DaemonConfig;
}

export interface DaemonRuntime {
  server: ReturnType<typeof createServer>;
  providers: ProviderRegistry;
  runs: RunRegistry;
  events: EventBus;
  logger: MemoryEventLogger;
  execution: ExecutionService;
  permissions: PermissionService;
}

export function buildDaemon(overrides?: Partial<DaemonDeps>): DaemonRuntime {
  const config = overrides?.config ?? loadConfig();

  const providers = new ProviderRegistry();
  const runs = new RunRegistry();
  const permissions = new PermissionService();
  const events = new EventBus({ bufferSize: 1000 });
  const logger = new MemoryEventLogger({ maxEntries: 1000, echoToConsole: false });

  const execution = new ExecutionService({
    providers,
    runs,
    permissions,
    events,
    logger,
    createId,
    now: nowIso,
  });

  const opencodeSdkFactory: OpenCodeSdkFactory = async (opts) => {
    const { createRealOpenCodeFactory } = await import("./adapters/providers/opencode/opencodeClient.js");
    return createRealOpenCodeFactory()(opts);
  };
  const claudeFacade: ClaudeSdkFacade = (() => {
    let facade: ClaudeSdkFacade | null = null;
    const proxy: ClaudeSdkFacade = {
      query: (options) => {
        if (!facade) throw new Error("Claude SDK not available. Install @anthropic-ai/claude-agent-sdk.");
        return facade.query(options);
      },
      tool: { create: async (i) => { throw new Error("Claude SDK not available"); } },
      createSdkMcpServer: async (i) => { throw new Error("Claude SDK not available"); },
      listSessions: async (i) => { throw new Error("Claude SDK not available"); },
      getSessionMessages: async (i) => { throw new Error("Claude SDK not available"); },
      getSessionInfo: async (i) => { throw new Error("Claude SDK not available"); },
      renameSession: async (i) => { throw new Error("Claude SDK not available"); },
      tagSession: async (i) => { throw new Error("Claude SDK not available"); },
    };
    return proxy;
  })();
  const codexSdkFactory: CodexSdkFactory = (opts) => {
    const { createRealCodexFactory } = require("./adapters/providers/codex/codexClient.js") as { createRealCodexFactory: () => CodexSdkFactory };
    return createRealCodexFactory()(opts);
  };

  const opencodeAdapter = new OpenCodeAdapter({
    sdkFactory: opencodeSdkFactory,
    eventBus: events,
    runRegistry: runs,
    permissionService: permissions,
  });
  const claudeAdapter = new ClaudeAdapter({
    facade: claudeFacade,
    eventBus: events,
    runRegistry: runs,
    permissionService: permissions,
  });
  const codexAdapter = new CodexAdapter({
    sdkFactory: codexSdkFactory,
    eventBus: events,
    runRegistry: runs,
    permissionService: permissions,
  });

  providers.register("opencode", opencodeAdapter);
  providers.register("claude", claudeAdapter);
  providers.register("codex", codexAdapter);

  const serverDeps: ServerDeps = { providers, runs, events, logger, execution };
  const server = createServer(serverDeps);

  return { server, providers, runs, events, logger, execution, permissions };
}

export async function startDaemon(): Promise<void> {
  const config = loadConfig();
  const runtime = buildDaemon();
  await runtime.server.listen({ port: config.port, host: config.host });
}
