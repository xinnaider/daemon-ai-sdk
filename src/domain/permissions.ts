export type PermissionDecision = "allow" | "deny";

export type PermissionScope = "once" | "always" | "until_reply";

export interface PermissionRequest {
  id: string;
  runId: string;
  action: string;
  resource: string;
  context: Record<string, unknown>;
}

export interface PermissionResolution {
  decision: PermissionDecision;
  scope: PermissionScope;
}

export interface PendingPermission {
  promise: Promise<PermissionResolution>;
  request: PermissionRequest;
  createdAt: string;
}
