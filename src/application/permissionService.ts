import type { PendingPermission, PermissionResolution } from "../domain/permissions.js";

interface CreatePendingInput {
  permissionId: string;
  runId: string;
  provider: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: string;
}

interface StoredPending {
  permission: PendingPermission;
  resolve: (resolution: PermissionResolution) => void;
  reject: (error: Error) => void;
}

export class PermissionService {
  private pendings = new Map<string, StoredPending>();

  private key(runId: string, permissionId: string): string {
    return `${runId}:${permissionId}`;
  }

  createPending(input: CreatePendingInput): PendingPermission {
    let resolve!: (resolution: PermissionResolution) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<PermissionResolution>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const stored: StoredPending = {
      permission: {
        promise,
        request: {
          id: input.permissionId,
          runId: input.runId,
          action: input.toolName,
          resource: JSON.stringify(input.toolInput),
          context: { provider: input.provider, toolInput: input.toolInput },
        },
        createdAt: input.createdAt,
      },
      resolve,
      reject,
    };

    this.pendings.set(this.key(input.runId, input.permissionId), stored);
    return stored.permission;
  }

  getPending(runId: string, permissionId: string): PendingPermission | undefined {
    return this.pendings.get(this.key(runId, permissionId))?.permission;
  }

  resolve(runId: string, permissionId: string, resolution: PermissionResolution): void {
    const stored = this.pendings.get(this.key(runId, permissionId));
    if (!stored) {
      throw new Error(`No pending permission for ${runId}:${permissionId}`);
    }
    stored.resolve(resolution);
    this.pendings.delete(this.key(runId, permissionId));
  }

  rejectAllForRun(runId: string): void {
    for (const [k, stored] of this.pendings) {
      if (k.startsWith(`${runId}:`)) {
        stored.reject(new Error(`Permission rejected for run ${runId}`));
        this.pendings.delete(k);
      }
    }
  }
}
