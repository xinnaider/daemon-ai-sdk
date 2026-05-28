import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../src/infrastructure/redaction.js";

describe("redactSecrets", () => {
  it("redacts common API key fields recursively", () => {
    const redacted = redactSecrets({
      apiKey: "sk-secret",
      env: {
        OPENAI_API_KEY: "openai-secret",
        SAFE_VALUE: "visible"
      },
      nested: [{ token: "abc", cwd: "C:/repo" }]
    });

    expect(redacted).toEqual({
      apiKey: "[REDACTED]",
      env: {
        OPENAI_API_KEY: "[REDACTED]",
        SAFE_VALUE: "visible"
      },
      nested: [{ token: "[REDACTED]", cwd: "C:/repo" }]
    });
  });
});
