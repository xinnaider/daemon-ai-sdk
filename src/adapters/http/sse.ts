import type { DaemonEvent } from "../../domain/events.js";
import type { ServerResponse } from "node:http";

export function encodeSseFrame(event: DaemonEvent): string {
  const data = JSON.stringify(event.data);
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${data}`,
    "",
  ].join("\n");
}

export function sendSseEvent(res: ServerResponse, event: DaemonEvent): void {
  res.write(encodeSseFrame(event) + "\n");
}

export function sendSseHeartbeat(res: ServerResponse): void {
  res.write(": heartbeat\n\n");
}

export function writeSseHeaders(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
}
