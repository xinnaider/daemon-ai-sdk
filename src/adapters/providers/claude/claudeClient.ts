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

export function createRealClaudeFacade(): ClaudeSdkFacade {
  const sdk = await_import();
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

function await_import() {
  throw new Error(
    "Claude SDK not bundled. Use createRealClaudeFacade() only at runtime with the @anthropic-ai/claude-agent-sdk package installed."
  );
}
