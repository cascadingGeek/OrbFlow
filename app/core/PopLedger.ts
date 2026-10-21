/** What the chart remembers about a popped bubble so it can come back. */
export interface PopRecord {
  id: string;
  label: string;
  value: number;
  color?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  /** Resting place at pop time, not the drawn center. */
  x: number;
  y: number;
  /** Position in the `getData()` list at pop time. */
  index: number;
  /** True when a user activation popped it, false when `pop(id)` did. */
  byUser: boolean;
}

/**
 * The popped bubbles, in pop order. A record leaves when its bubble is
 * restored, and all of them leave when new data arrives.
 */
export class PopLedger {
  private records = new Map<string, PopRecord>();

  /** Adds a record. Last popped is last in `all()`. */
  remember(record: PopRecord) {
    this.records.delete(record.id);
    this.records.set(record.id, record);
  }

  /** The record for `id`, or `undefined`. */
  get(id: string): PopRecord | undefined {
    return this.records.get(id);
  }

  /** Removes and returns the record for `id`. */
  take(id: string): PopRecord | undefined {
    const record = this.records.get(id);
    this.records.delete(id);
    return record;
  }

  /** Every record, in pop order. */
  all(): PopRecord[] {
    return [...this.records.values()];
  }

  /** The records a user activation popped, in pop order. */
  byUser(): PopRecord[] {
    return this.all().filter((record) => record.byUser);
  }

  /** Forgets every record. */
  clear() {
    this.records.clear();
  }
}
