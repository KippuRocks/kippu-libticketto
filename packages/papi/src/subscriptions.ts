import {
  EventSubscription as IEventSubscription,
  SystemEvent,
} from "@ticketto/protocol";

import { inject, injectable } from "inversify";
import { TOKEN } from "./types.ts";

type EventCallback<T> = (event: T) => void;

@injectable("Singleton")
export class EventQueue {
  #subscribers: EventCallback<SystemEvent>[] = [];

  subscribe(subscriber: EventCallback<SystemEvent>) {
    this.#subscribers.push(subscriber);
  }

  depositEvent(event: SystemEvent) {
    for (const subscriber of this.#subscribers) {
      subscriber(event);
    }
  }
}

@injectable()
export class WebStubEventSubscribtion
  implements IEventSubscription<SystemEvent>
{
  constructor(@inject(TOKEN.QUEUE) private queue: EventQueue) {}

  on(callback: EventCallback<SystemEvent>): void {
    this.queue.subscribe(callback);
  }
}
