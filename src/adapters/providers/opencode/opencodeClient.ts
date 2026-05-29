export type OpenCodeSdkClient = {
  global: { health: () => Promise<unknown> };
  app: { log: (input: unknown) => Promise<unknown>; agents: () => Promise<unknown> };
  config: { get: () => Promise<unknown>; providers: () => Promise<unknown> };
  path: { get: () => Promise<unknown> };
  project: { list: () => Promise<unknown>; current: () => Promise<unknown> };
  auth: { set: (input: unknown) => Promise<unknown> };
  session: {
    list: () => Promise<unknown>;
    create: (input?: unknown) => Promise<unknown>;
    get: (id: string) => Promise<unknown>;
    children: (id: string) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
    update: (id: string, input: unknown) => Promise<unknown>;
    init: (input?: unknown) => Promise<unknown>;
    share: (id: string) => Promise<unknown>;
    unshare: (id: string) => Promise<unknown>;
    summarize: (id: string) => Promise<unknown>;
    messages: (id: string) => Promise<unknown>;
    message: (id: string, msgId: string) => Promise<unknown>;
    command: (id: string, input: unknown) => Promise<unknown>;
    shell: (id: string, input: unknown) => Promise<unknown>;
    revert: (id: string) => Promise<unknown>;
    unrevert: (id: string) => Promise<unknown>;
    prompt: (id: string, input: unknown) => Promise<unknown>;
    abort: (id: string) => Promise<unknown>;
    permission: { reply: (sessionId: string, permissionId: string, input: unknown) => Promise<unknown> };
  };
  find: { text: (input: unknown) => Promise<unknown>; files: (input: unknown) => Promise<unknown>; symbols: (input: unknown) => Promise<unknown> };
  file: { read: (input: unknown) => Promise<unknown>; status: (input: unknown) => Promise<unknown> };
  tui: {
    appendPrompt: (input: unknown) => Promise<unknown>;
    openHelp: () => Promise<unknown>;
    openSessions: () => Promise<unknown>;
    openThemes: () => Promise<unknown>;
    openModels: () => Promise<unknown>;
    submitPrompt: (input: unknown) => Promise<unknown>;
    clearPrompt: () => Promise<unknown>;
    executeCommand: (input: unknown) => Promise<unknown>;
    showToast: (input: unknown) => Promise<unknown>;
  };
  event: { subscribe: (sessionId: string, callback: (event: unknown) => void) => Promise<() => void> };
};

export type OpenCodeFactoryOptions = Record<string, unknown>;

export type OpenCodeSdkFactory = (options: OpenCodeFactoryOptions) => Promise<OpenCodeSdkClient>;

export function createRealOpenCodeFactory(): OpenCodeSdkFactory {
  return async (_options: OpenCodeFactoryOptions): Promise<OpenCodeSdkClient> => {
    const { createOpencodeClient } = await import("@opencode-ai/sdk");
    const sdk = await createOpencodeClient({});
    return sdk as unknown as OpenCodeSdkClient;
  };
}
