export type EventType =
  | 'request'
  | 'order_transition'
  | 'webhook_received'
  | 'promo_rejected'
  | 'spec_changed'
  | 'admin_reset';

export interface SystemEvent {
  id: string;
  timestamp: string;
  type: EventType;
  description: string;
  details?: Record<string, unknown>;
}

export class EventLog {
  private static readonly MAX_EVENTS = 500;
  private events: SystemEvent[] = [];
  private counter = 0;

  public record(
    type: EventType,
    description: string,
    details?: Record<string, unknown>
  ): SystemEvent {
    this.counter += 1;
    const event: SystemEvent = {
      id: `evt_${Date.now()}_${this.counter}`,
      timestamp: new Date().toISOString(),
      type,
      description,
      details,
    };

    this.events.unshift(event);
    if (this.events.length > EventLog.MAX_EVENTS) {
      this.events.length = EventLog.MAX_EVENTS;
    }
    return event;
  }

  public getRecent(limit = 50): SystemEvent[] {
    return this.events.slice(0, Math.min(limit, this.events.length));
  }

  public clear(): void {
    this.events = [];
    this.counter = 0;
  }

  public count(): number {
    return this.events.length;
  }
}

export const eventLog = new EventLog();

