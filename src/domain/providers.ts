export interface ProviderCapabilities {
  maxConcurrency: number;
  supportsStreaming: boolean;
  supportsSdkActions: boolean;
}

export interface SdkActionDescriptor {
  id: string;
  provider: string;
  scope: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  streaming: boolean;
  sideEffects: boolean;
}

export interface SdkActionResult {
  actionId: string;
  output: unknown;
  durationMs: number;
}

export interface ProviderSdkActionRequest {
  actionId: string;
  input: Record<string, unknown>;
}

export interface RunSdkActionRequest {
  runId: string;
  actionId: string;
  input: Record<string, unknown>;
}
