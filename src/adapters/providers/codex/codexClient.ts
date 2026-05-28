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

export type CodexSdkFactory = (options: CodexFactoryOptions) => CodexSdkClient;

export function createRealCodexFactory(): CodexSdkFactory {
  return (options: CodexFactoryOptions): CodexSdkClient => {
    const { Codex } = require("@openai/codex-sdk") as { Codex: new (opts: Record<string, unknown>) => unknown };
    const sdk = new Codex({ apiKey: options.apiKey, baseUrl: options.baseUrl });
    return sdk as unknown as CodexSdkClient;
  };
}
