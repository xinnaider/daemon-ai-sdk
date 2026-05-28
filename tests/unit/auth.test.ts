import { describe, expect, it, vi } from "vitest";
import { resolveAuthMode } from "../../src/domain/auth.js";
import { detectCli } from "../../src/infrastructure/cli.js";
import { createId } from "../../src/infrastructure/ids.js";
import { nowIso } from "../../src/infrastructure/time.js";
import { badRequest, notFound, providerFailure, permissionFailure, DaemonError } from "../../src/domain/errors.js";

describe("auth mode", () => {
  it("defaults run requests to auto auth mode", () => {
    expect(resolveAuthMode(undefined)).toBe("auto");
  });

  it("accepts explicit cli and sdk auth modes", () => {
    expect(resolveAuthMode("cli")).toBe("cli");
    expect(resolveAuthMode("sdk")).toBe("sdk");
  });

  it("throws on invalid auth mode", () => {
    expect(() => resolveAuthMode("invalid" as any)).toThrow("Invalid auth mode: invalid");
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

describe("createId", () => {
  it("returns a prefixed uuid without dashes", () => {
    const id = createId("run");
    expect(id).toMatch(/^run_[a-f0-9]{32}$/);
  });
});

describe("nowIso", () => {
  it("returns an ISO 8601 formatted date string", () => {
    const result = nowIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("DaemonError", () => {
  it("badRequest creates error with 400 status", () => {
    const err = badRequest("invalid input");
    expect(err).toBeInstanceOf(DaemonError);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("invalid input");
  });

  it("notFound creates error with 404 status", () => {
    const err = notFound("resource missing");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("providerFailure creates error with 502 status and optional provider prefix", () => {
    const err = providerFailure("timeout", "openai");
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe("PROVIDER_FAILURE");
    expect(err.message).toBe("[openai] timeout");
  });

  it("providerFailure without provider omits prefix", () => {
    const err = providerFailure("generic failure");
    expect(err.message).toBe("generic failure");
  });

  it("permissionFailure creates error with 403 status", () => {
    const err = permissionFailure("access denied");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("PERMISSION_FAILURE");
  });
});
