import type { OpencodeClient } from "@opencode-ai/sdk";

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

type SdkResult<T = unknown> = Promise<{ data?: T; error?: unknown }>;

type RawOpenCodeClient = {
  app: {
    log: (options?: unknown) => SdkResult;
    agents: (options?: unknown) => SdkResult;
  };
  auth: {
    set: (options: unknown) => SdkResult;
  };
  config: {
    get: (options?: unknown) => SdkResult;
    providers: (options?: unknown) => SdkResult;
  };
  event: {
    subscribe: (options: {
      signal?: AbortSignal;
      onSseEvent?: (event: { data: unknown }) => void;
      onSseError?: (error: unknown) => void;
    }) => Promise<{ stream: AsyncIterable<unknown> }>;
  };
  file: {
    read: (options: unknown) => SdkResult;
    status: (options?: unknown) => SdkResult;
  };
  find: {
    text: (options: unknown) => SdkResult;
    files: (options: unknown) => SdkResult;
    symbols: (options: unknown) => SdkResult;
  };
  path: {
    get: (options?: unknown) => SdkResult;
  };
  project: {
    list: (options?: unknown) => SdkResult;
    current: (options?: unknown) => SdkResult;
  };
  postSessionIdPermissionsPermissionId: (options: unknown) => SdkResult;
  session: {
    abort: (options: unknown) => SdkResult;
    children: (options: unknown) => SdkResult;
    command: (options: unknown) => SdkResult;
    create: (options?: unknown) => SdkResult;
    delete: (options: unknown) => SdkResult;
    get: (options: unknown) => SdkResult;
    init: (options: unknown) => SdkResult;
    list: (options?: unknown) => SdkResult;
    message: (options: unknown) => SdkResult;
    messages: (options: unknown) => SdkResult;
    prompt: (options: unknown) => SdkResult;
    revert: (options: unknown) => SdkResult;
    share: (options: unknown) => SdkResult;
    shell: (options: unknown) => SdkResult;
    summarize: (options: unknown) => SdkResult;
    unshare: (options: unknown) => SdkResult;
    unrevert: (options: unknown) => SdkResult;
    update: (options: unknown) => SdkResult;
  };
  tui: {
    appendPrompt: (options: unknown) => SdkResult;
    clearPrompt: (options?: unknown) => SdkResult;
    executeCommand: (options: unknown) => SdkResult;
    openHelp: (options?: unknown) => SdkResult;
    openModels: (options?: unknown) => SdkResult;
    openSessions: (options?: unknown) => SdkResult;
    openThemes: (options?: unknown) => SdkResult;
    showToast: (options: unknown) => SdkResult;
    submitPrompt: (options?: unknown) => SdkResult;
  };
};

type OpencodeBackend = {
  client: OpencodeClient;
  shutdown?: () => void;
};

let backendPromise: Promise<OpencodeBackend> | null = null;

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function oneOf(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

async function unwrapData<T = unknown>(result: SdkResult<T>): Promise<T> {
  const response = await result;
  if (response.error) {
    const error = asRecord(response.error);
    throw new Error(typeof error.message === "string" ? error.message : JSON.stringify(response.error));
  }
  if (response.data === undefined) {
    throw new Error("OpenCode SDK response missing data");
  }
  return response.data;
}

function promptBodyFromInput(input: unknown): Record<string, unknown> {
  const raw = asRecord(input);
  if (Array.isArray(raw.parts)) {
    return raw;
  }
  const prompt = raw.prompt;
  if (typeof prompt === "string") {
    return { parts: [{ type: "text", text: prompt }] };
  }
  return raw;
}

function bodyOptions(input?: unknown): { body?: unknown } {
  if (input === undefined) {
    return {};
  }
  return { body: input };
}

function queryOptions(input: unknown, keys: string[]): { query: Record<string, unknown> } {
  const raw = asRecord(input);
  const query = { ...raw };
  const value = oneOf(raw, keys);
  if (value) {
    query[keys[0]!] = value;
  }
  return { query };
}

function permissionBody(input: unknown): { response: "once" | "always" | "reject" } {
  const raw = asRecord(input);
  if (raw.decision === "deny") {
    return { response: "reject" };
  }
  if (raw.scope === "always") {
    return { response: "always" };
  }
  return { response: "once" };
}

function sessionIdsFromEvent(event: Record<string, unknown>): string[] {
  const props = asRecord(event.properties);
  const info = asRecord(props.info);
  const part = asRecord(props.part);
  return [props.sessionID, info.sessionID, info.id, part.sessionID].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function eventMatchesSession(event: Record<string, unknown>, sessionId: string): boolean {
  const ids = sessionIdsFromEvent(event);
  return ids.length === 0 || ids.includes(sessionId);
}

function createClientOptions(baseUrl: string, directory?: string): { baseUrl: string; directory?: string } {
  const options: { baseUrl: string; directory?: string } = { baseUrl };
  if (directory) {
    options.directory = directory;
  }
  return options;
}

async function connectOpencodeClient(
  createOpencodeClient: typeof import("@opencode-ai/sdk").createOpencodeClient,
  baseUrl: string,
  directory?: string,
): Promise<OpencodeClient | null> {
  try {
    const client = createOpencodeClient(createClientOptions(baseUrl, directory));
    const result = await client.config.get();
    if (result.error) {
      return null;
    }
    return client;
  } catch {
    return null;
  }
}

async function createBackend(options: OpenCodeFactoryOptions): Promise<OpencodeBackend> {
  const { createOpencode, createOpencodeClient } = await import("@opencode-ai/sdk");
  const directory = typeof options.directory === "string" ? options.directory : undefined;
  const hostname = process.env.OPENCODE_HOST ?? "127.0.0.1";
  const port = Number(process.env.OPENCODE_PORT ?? 4096);
  const defaultBaseUrl = `http://${hostname}:${port}`;
  const explicitBaseUrl =
    (typeof process.env.OPENCODE_BASE_URL === "string" && process.env.OPENCODE_BASE_URL) ||
    (typeof options.baseUrl === "string" ? options.baseUrl : undefined);

  for (const baseUrl of explicitBaseUrl ? [explicitBaseUrl] : [defaultBaseUrl]) {
    const existing = await connectOpencodeClient(createOpencodeClient, baseUrl, directory);
    if (existing) {
      return { client: existing };
    }
  }

  if (explicitBaseUrl) {
    throw new Error(`OpenCode server not reachable at ${explicitBaseUrl}`);
  }

  const { client, server } = await createOpencode({ hostname, port });
  return { client, shutdown: () => server.close() };
}

async function resolveBackend(options: OpenCodeFactoryOptions): Promise<OpencodeBackend> {
  if (!backendPromise) {
    backendPromise = createBackend(options).catch((err) => {
      backendPromise = null;
      throw err;
    });
  }
  return backendPromise;
}

export function resetOpencodeBackend(): void {
  backendPromise = null;
}

export function isOpencodeFetchFailure(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const message = err.message.toLowerCase();
  return message === "fetch failed" || message.includes("econnrefused") || message.includes("enotfound");
}

export function wrapOpencodeClient(client: unknown): OpenCodeSdkClient {
  const sdk = client as RawOpenCodeClient;

  return {
    global: {
      health: async () => ({ status: "ok", config: await unwrapData(sdk.config.get()) }),
    },
    app: {
      log: async (input) => unwrapData(sdk.app.log(bodyOptions(input))),
      agents: async () => unwrapData(sdk.app.agents()),
    },
    config: {
      get: async () => unwrapData(sdk.config.get()),
      providers: async () => unwrapData(sdk.config.providers()),
    },
    path: {
      get: async () => unwrapData(sdk.path.get()),
    },
    project: {
      list: async () => unwrapData(sdk.project.list()),
      current: async () => unwrapData(sdk.project.current()),
    },
    auth: {
      set: async (input) => {
        const raw = asRecord(input);
        const id = oneOf(raw, ["id", "provider", "providerID"]);
        if (!id) {
          throw new Error("auth.set requires input.id or input.provider");
        }
        return unwrapData(sdk.auth.set({ path: { id }, body: raw }));
      },
    },
    session: {
      list: async () => unwrapData(sdk.session.list()),
      create: async (input) => unwrapData(sdk.session.create(bodyOptions(input))),
      get: async (id) => unwrapData(sdk.session.get({ path: { id } })),
      children: async (id) => unwrapData(sdk.session.children({ path: { id } })),
      delete: async (id) => unwrapData(sdk.session.delete({ path: { id } })),
      update: async (id, input) => unwrapData(sdk.session.update({ path: { id }, body: input })),
      init: async (input) => {
        const raw = asRecord(input);
        const id = oneOf(raw, ["id"]);
        return unwrapData(sdk.session.init({ path: { id: id ?? "" }, body: raw }));
      },
      share: async (id) => unwrapData(sdk.session.share({ path: { id } })),
      unshare: async (id) => unwrapData(sdk.session.unshare({ path: { id } })),
      summarize: async (id) => unwrapData(sdk.session.summarize({ path: { id } })),
      messages: async (id) => unwrapData(sdk.session.messages({ path: { id } })),
      message: async (id, msgId) => unwrapData(sdk.session.message({ path: { id, messageID: msgId } })),
      command: async (id, input) => unwrapData(sdk.session.command({ path: { id }, body: input })),
      shell: async (id, input) => unwrapData(sdk.session.shell({ path: { id }, body: input })),
      revert: async (id) => unwrapData(sdk.session.revert({ path: { id } })),
      unrevert: async (id) => unwrapData(sdk.session.unrevert({ path: { id } })),
      prompt: async (id, input) =>
        unwrapData(sdk.session.prompt({ path: { id }, body: promptBodyFromInput(input) })),
      abort: async (id) => unwrapData(sdk.session.abort({ path: { id } })),
      permission: {
        reply: async (sessionId, permissionId, input) =>
          unwrapData(
            sdk.postSessionIdPermissionsPermissionId({
              path: { id: sessionId, permissionID: permissionId },
              body: permissionBody(input),
            }),
          ),
      },
    },
    find: {
      text: async (input) => unwrapData(sdk.find.text(queryOptions(input, ["pattern", "query", "text"]))),
      files: async (input) => unwrapData(sdk.find.files(queryOptions(input, ["pattern", "query", "text"]))),
      symbols: async (input) => unwrapData(sdk.find.symbols(queryOptions(input, ["pattern", "query", "text"]))),
    },
    file: {
      read: async (input) => unwrapData(sdk.file.read(queryOptions(input, ["path"]))),
      status: async () => unwrapData(sdk.file.status()),
    },
    tui: {
      appendPrompt: async (input) => unwrapData(sdk.tui.appendPrompt(bodyOptions(input))),
      openHelp: async () => unwrapData(sdk.tui.openHelp()),
      openSessions: async () => unwrapData(sdk.tui.openSessions()),
      openThemes: async () => unwrapData(sdk.tui.openThemes()),
      openModels: async () => unwrapData(sdk.tui.openModels()),
      submitPrompt: async () => unwrapData(sdk.tui.submitPrompt()),
      clearPrompt: async () => unwrapData(sdk.tui.clearPrompt()),
      executeCommand: async (input) => unwrapData(sdk.tui.executeCommand(bodyOptions(input))),
      showToast: async (input) => unwrapData(sdk.tui.showToast(bodyOptions(input))),
    },
    event: {
      subscribe: async (sessionId, callback) => {
        const abort = new AbortController();
        const sse = await sdk.event.subscribe({
          signal: abort.signal,
          onSseEvent: (sseEvent) => {
            const data = asRecord(sseEvent.data);
            if (eventMatchesSession(data, sessionId)) {
              callback(data);
            }
          },
          onSseError: (err) => {
            if (!abort.signal.aborted) {
              console.warn(`[daemon] opencode SSE error session=${sessionId}:`, err);
            }
          },
        });

        void (async () => {
          try {
            for await (const _ of sse.stream) {
              // The SDK invokes onSseEvent while this stream is consumed.
            }
          } catch (err) {
            if (!abort.signal.aborted) {
              console.warn(`[daemon] opencode SSE stream closed session=${sessionId}:`, err);
            }
          }
        })();

        return () => abort.abort();
      },
    },
  };
}

export function createRealOpenCodeFactory(): OpenCodeSdkFactory {
  return async (options: OpenCodeFactoryOptions): Promise<OpenCodeSdkClient> => {
    const withBackend = async () => wrapOpencodeClient((await resolveBackend(options)).client);
    try {
      return await withBackend();
    } catch (err) {
      if (!isOpencodeFetchFailure(err)) {
        throw err;
      }
      resetOpencodeBackend();
      return withBackend();
    }
  };
}
