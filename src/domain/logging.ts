export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEventKind = string & { __brand: "LogEventKind" };

export interface LogEntry {
  id: string;
  createdAt: string;
  level: LogLevel;
  kind: LogEventKind;
  message: string;
  data?: Record<string, unknown>;
}

export interface LogFilter {
  level?: LogLevel;
  kind?: LogEventKind;
  runId?: string;
  provider?: string;
}
