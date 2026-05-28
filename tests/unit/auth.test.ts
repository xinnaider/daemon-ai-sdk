import { describe, expect, it, vi } from "vitest";
import { resolveAuthMode } from "../../src/domain/auth.js";
import { detectCli } from "../../src/infrastructure/cli.js";

describe("auth mode", () => {
  it("defaults run requests to auto auth mode", () => {
    expect(resolveAuthMode(undefined)).toBe("auto");
  });

  it("accepts explicit cli and sdk auth modes", () => {
    expect(resolveAuthMode("cli")).toBe("cli");
    expect(resolveAuthMode("sdk")).toBe("sdk");
  });
});

describe("detectCli", () => {
  it("returns unavailable when a binary cannot be found", async () => {
    const execFile = vi.fn().mockRejectedValue(new Error("not found"));
    await expect(detectCli("missing-cli", execFile)).resolves.toEqual({
      available: false,
      path: null
    });
  });
});
