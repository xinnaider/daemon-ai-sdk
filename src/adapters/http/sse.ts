import type { DaemonEvent } from "../../domain/events.js";

export function encodeSseFrame(event: DaemonEvent): string {
  const data = JSON.stringify(event.data);
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${data}`,
    ""
  ].join("\n");
}
