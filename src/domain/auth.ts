import { badRequest } from "./errors.js";

export type AuthMode = "auto" | "cli" | "sdk";

export interface ProviderAuthStatus {
  mode: AuthMode;
  available: boolean;
  source: string | null;
  requiresApiKey: boolean;
}

const VALID_AUTH_MODES = new Set<AuthMode>(["auto", "cli", "sdk"]);

export function resolveAuthMode(mode: AuthMode | undefined): AuthMode {
  if (mode === undefined) {
    return "auto";
  }
  if (!VALID_AUTH_MODES.has(mode)) {
    throw badRequest(`Invalid auth mode: ${mode}`);
  }
  return mode;
}
