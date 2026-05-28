import type { LogEntry, LogFilter } from "../domain/logging.js";

export interface EventLogger {
  log(entry: LogEntry): Promise<void>;
  list(filter?: LogFilter): Promise<LogEntry[]>;
}
