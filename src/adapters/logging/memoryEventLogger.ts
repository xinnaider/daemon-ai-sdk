import type { LogEntry, LogFilter } from "../../domain/logging.js";
import type { EventLogger } from "../../ports/eventLogger.js";
import { redactSecrets } from "../../infrastructure/redaction.js";

export interface MemoryEventLoggerOptions {
  maxEntries: number;
  echoToConsole: boolean;
}

export class MemoryEventLogger implements EventLogger {
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;
  private readonly echoToConsole: boolean;

  constructor(options: MemoryEventLoggerOptions) {
    this.maxEntries = options.maxEntries;
    this.echoToConsole = options.echoToConsole;
  }

  async log(entry: LogEntry): Promise<void> {
    const redacted = {
      ...entry,
      data: entry.data ? (redactSecrets(entry.data) as Record<string, unknown>) : undefined,
    };

    this.entries.push(redacted);

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    if (this.echoToConsole) {
      console.log(JSON.stringify(redacted));
    }
  }

  async list(filter?: LogFilter): Promise<LogEntry[]> {
    let result = this.entries;

    if (filter) {
      if (filter.level !== undefined) {
        result = result.filter((e) => e.level === filter.level);
      }
      if (filter.kind !== undefined) {
        result = result.filter((e) => e.kind === filter.kind);
      }
      if (filter.runId !== undefined) {
        result = result.filter((e) => (e.data as Record<string, unknown> | undefined)?.runId === filter.runId);
      }
      if (filter.provider !== undefined) {
        result = result.filter((e) => (e.data as Record<string, unknown> | undefined)?.provider === filter.provider);
      }
    }

    return result;
  }
}
