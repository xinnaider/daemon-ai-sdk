import type { ProviderId, DaemonEvent } from "../domain/events.js";
import { normalizeCodexEvent } from "../adapters/providers/codex/codexNormalizer.js";
import { normalizeClaudeMessage } from "../adapters/providers/claude/claudeNormalizer.js";
import { normalizeOpenCodeEvent } from "../adapters/providers/opencode/opencodeNormalizer.js";

export interface NormalizeInput {
  provider: ProviderId;
  raw: unknown;
  runId: string;
  sequence: number;
}

export function normalizeRawEvent(input: NormalizeInput): DaemonEvent[] {
  switch (input.provider) {
    case "codex":
      return normalizeCodexEvent(input);
    case "claude":
      return normalizeClaudeMessage(input);
    case "opencode":
      return normalizeOpenCodeEvent(input);
    default:
      return [
        {
          id: `evt_${input.sequence}`,
          runId: input.runId,
          provider: input.provider,
          type: "unknown" as DaemonEvent["type"],
          createdAt: new Date().toISOString(),
          sequence: input.sequence,
          data: { raw: input.raw },
        },
      ];
  }
}
