export interface DaemonConfig {
  port: number;
  host: string;
  logLevel: string;
  eventBufferSize: number;
}

export function loadConfig(): DaemonConfig {
  return {
    port: parseInt(process.env["DAEMON_PORT"] ?? "4317", 10),
    host: process.env["DAEMON_HOST"] ?? "127.0.0.1",
    logLevel: process.env["DAEMON_LOG_LEVEL"] ?? "info",
    eventBufferSize: parseInt(process.env["DAEMON_EVENT_BUFFER_SIZE"] ?? "1000", 10),
  };
}
