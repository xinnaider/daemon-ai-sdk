import type { DaemonEvent } from "../domain/events.js";

type Listener = (event: DaemonEvent) => void;

interface Subscriber {
  runId: string | "all";
  listener: Listener;
}

export interface EventBusOptions {
  bufferSize: number;
}

export class EventBus {
  private events: DaemonEvent[] = [];
  private subscribers: Subscriber[] = [];
  private bufferSize: number;

  constructor(options: EventBusOptions) {
    this.bufferSize = options.bufferSize;
  }

  publish(event: DaemonEvent): void {
    if (this.events.length >= this.bufferSize) {
      this.events.shift();
    }
    this.events.push(event);

    for (const sub of this.subscribers) {
      if (sub.runId === "all" || sub.runId === event.runId) {
        sub.listener(event);
      }
    }
  }

  replay(runId: string): DaemonEvent[] {
    return this.events.filter((e) => e.runId === runId);
  }

  subscribe(runId: string | "all", listener: Listener): () => void {
    const sub: Subscriber = { runId, listener };
    this.subscribers.push(sub);
    return () => {
      const idx = this.subscribers.indexOf(sub);
      if (idx !== -1) {
        this.subscribers.splice(idx, 1);
      }
    };
  }
}
