import { EventEmitter } from "events";


const globalForEventBus = globalThis as unknown as { eventBus: EventEmitter | undefined };

export const eventBus = globalForEventBus.eventBus ?? (globalForEventBus.eventBus = new EventEmitter());
eventBus.setMaxListeners(100);