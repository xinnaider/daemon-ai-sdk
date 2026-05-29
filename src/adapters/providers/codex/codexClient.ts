export interface CodexFactoryOptions {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface CodexSdkClient {
  startThread(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  resumeThread(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  run(input: Record<string, unknown>): Promise<Record<string, unknown>> | AsyncGenerator<Record<string, unknown>, void, unknown>;
}

export type CodexSdkFactory = (options: CodexFactoryOptions) => Promise<CodexSdkClient>;

export function createRealCodexFactory(): CodexSdkFactory {
  return async (options: CodexFactoryOptions): Promise<CodexSdkClient> => {
    const { Codex } = await import("@openai/codex-sdk");
    const codexOpts: Record<string, string> = {};
    if (options.apiKey !== undefined) codexOpts.apiKey = options.apiKey;
    if (options.baseUrl !== undefined) codexOpts.baseUrl = options.baseUrl;
    const sdk = new Codex(codexOpts);
    return sdk as unknown as CodexSdkClient;
  };
}
