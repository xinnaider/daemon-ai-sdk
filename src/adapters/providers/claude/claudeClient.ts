export type ClaudeSdkFacade = {
  query: (options: QueryOptions) => QueryInstance;
  tool: { create: (input: Record<string, unknown>) => Promise<Record<string, unknown>> };
  createSdkMcpServer: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  listSessions: (input?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  getSessionMessages: (input: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  getSessionInfo: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  renameSession: (input: Record<string, unknown>) => Promise<void>;
  tagSession: (input: Record<string, unknown>) => Promise<void>;
};

export type QueryOptions = {
  prompt: string;
  signal?: AbortSignal;
  permissionMode?: "normal" | "yolo";
  allowedTools?: string[];
  disallowedTools?: string[];
  canUseTool?: (toolName: string, toolInput: unknown) => Promise<{ decision: "allow" | "deny"; scope: "once" | "always" | "until_reply" }>;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  mcpServers?: Record<string, unknown>;
  agents?: unknown[];
  includePartialMessages?: boolean;
  onStreamEvent?: (event: unknown) => void;
};

export type QueryInstance = {
  close: () => Promise<void>;
  interrupt: () => Promise<void>;
  initializationResult: Promise<unknown>;
  supportedCommands: Promise<unknown[]>;
  supportedModels: Promise<string[]>;
  supportedAgents: Promise<unknown[]>;
  accountInfo: Promise<unknown>;
  rewindFiles: () => Promise<void>;
  setPermissionMode: (mode: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  setMaxThinkingTokens: (tokens: number) => Promise<void>;
  mcpServerStatus: Promise<unknown>;
  reconnectMcpServer: (name: string) => Promise<void>;
  toggleMcpServer: (name: string, enabled: boolean) => Promise<void>;
  setMcpServers: (servers: unknown[]) => Promise<void>;
  streamInput: (input: string) => Promise<void>;
  stopTask: () => Promise<void>;
  [key: string]: unknown;
};

let cachedFacade: ClaudeSdkFacade | null = null;

function wrapSdk(sdk: {
  query: (options: QueryOptions) => QueryInstance;
  tool: ClaudeSdkFacade["tool"];
  createSdkMcpServer: ClaudeSdkFacade["createSdkMcpServer"];
  listSessions: ClaudeSdkFacade["listSessions"];
  getSessionMessages: ClaudeSdkFacade["getSessionMessages"];
  getSessionInfo: ClaudeSdkFacade["getSessionInfo"];
  renameSession: ClaudeSdkFacade["renameSession"];
  tagSession: ClaudeSdkFacade["tagSession"];
}): ClaudeSdkFacade {
  return {
    query: (options) => sdk.query(options),
    tool: sdk.tool,
    createSdkMcpServer: (input) => sdk.createSdkMcpServer(input),
    listSessions: (input) => sdk.listSessions(input),
    getSessionMessages: (input) => sdk.getSessionMessages(input),
    getSessionInfo: (input) => sdk.getSessionInfo(input),
    renameSession: (input) => sdk.renameSession(input),
    tagSession: (input) => sdk.tagSession(input),
  };
}

export async function ensureClaudeSdkLoaded(): Promise<ClaudeSdkFacade> {
  if (cachedFacade) return cachedFacade;
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  cachedFacade = wrapSdk(sdk as unknown as Parameters<typeof wrapSdk>[0]);
  return cachedFacade;
}

export function createRealClaudeFacade(): ClaudeSdkFacade {
  const requireLoaded = (): ClaudeSdkFacade => {
    if (!cachedFacade) {
      throw new Error("Claude SDK not loaded. Call ensureClaudeSdkLoaded() before using Claude.");
    }
    return cachedFacade;
  };

  return {
    query: (options) => requireLoaded().query(options),
    tool: {
      create: (input) => requireLoaded().tool.create(input),
    },
    createSdkMcpServer: (input) => requireLoaded().createSdkMcpServer(input),
    listSessions: (input) => requireLoaded().listSessions(input),
    getSessionMessages: (input) => requireLoaded().getSessionMessages(input),
    getSessionInfo: (input) => requireLoaded().getSessionInfo(input),
    renameSession: (input) => requireLoaded().renameSession(input),
    tagSession: (input) => requireLoaded().tagSession(input),
  };
}
