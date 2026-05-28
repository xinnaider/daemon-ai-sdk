import { describe, expect, it } from "vitest";
import { PermissionService } from "../../src/application/permissionService.js";

describe("PermissionService", () => {
  it("creates a pending permission and resolves it once", async () => {
    const service = new PermissionService();
    const pending = service.createPending({
      permissionId: "perm_1",
      runId: "run_1",
      provider: "claude",
      toolName: "Bash",
      toolInput: { command: "pwd" },
      createdAt: "now"
    });

    service.resolve("run_1", "perm_1", { decision: "allow", scope: "once" });

    await expect(pending.promise).resolves.toEqual({ decision: "allow", scope: "once" });
    expect(service.getPending("run_1", "perm_1")).toBeUndefined();
  });

  it("rejects duplicate resolution", () => {
    const service = new PermissionService();
    service.createPending({
      permissionId: "perm_1",
      runId: "run_1",
      provider: "claude",
      toolName: "Bash",
      toolInput: { command: "pwd" },
      createdAt: "now"
    });

    service.resolve("run_1", "perm_1", { decision: "allow", scope: "once" });
    expect(() => service.resolve("run_1", "perm_1", { decision: "deny", scope: "once" })).toThrow();
  });

  it("rejects all pending for a run", async () => {
    const service = new PermissionService();
    const p1 = service.createPending({
      permissionId: "perm_1",
      runId: "run_1",
      provider: "claude",
      toolName: "Bash",
      toolInput: { command: "pwd" },
      createdAt: "now"
    });
    const p2 = service.createPending({
      permissionId: "perm_2",
      runId: "run_1",
      provider: "claude",
      toolName: "Write",
      toolInput: { path: "test.txt" },
      createdAt: "now"
    });

    service.rejectAllForRun("run_1");

    await expect(p1.promise).rejects.toThrow();
    await expect(p2.promise).rejects.toThrow();
  });
});
