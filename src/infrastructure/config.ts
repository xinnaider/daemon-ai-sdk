export interface DaemonConfig {
  port: number;
  host: string;
  logLevel: string;
}

export function loadConfig(): DaemonConfig {
  return {
    port: parseInt(process.env["DAEMON_PORT"] ?? "3000", 10),
    host: process.env["DAEMON_HOST"] ?? "127.0.0.1",
    logLevel: process.env["DAEMON_LOG_LEVEL"] ?? "info",
  };
}
