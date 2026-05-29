import type { AuthMode } from "./auth.js";

export type PermissionMode = "normal" | "yolo";

export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ProviderInputPart {
  type: string;
  data: unknown;
}

export interface AgentRunRequest {
  id: string;
  createdAt: string;
  provider: string;
  prompt: string;
  authMode?: AuthMode;
  permissionMode?: PermissionMode;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  mcpServers?: Record<string, unknown>;
  agents?: unknown[];
}

export interface AgentRun {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  prompt: string;
  status: RunStatus;
  authMode: AuthMode;
  permissionMode: PermissionMode;
}

export function createRun(request: AgentRunRequest): AgentRun {
  return {
    id: request.id,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
    provider: request.provider,
    prompt: request.prompt,
    status: "queued",
    authMode: request.authMode ?? "auto",
    permissionMode: request.permissionMode ?? "normal",
  };
}
