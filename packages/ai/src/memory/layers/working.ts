import type { IConsolidatable, MemoryInput, MemoryQuery, MemoryResult, ConsolidationResult } from '../types';

const MAX_CAPACITY = 20;

interface WorkingEntry {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  createdAt: Date;
}

export class WorkingMemory implements IConsolidatable {
  readonly layer = 'working' as const;

  private sessions = new Map<string, WorkingEntry[]>();
  private onConsolidate?: (entries: WorkingEntry[]) => Promise<void>;

  constructor(private readonly capacity = MAX_CAPACITY) {}

  setConsolidationHandler(handler: (entries: WorkingEntry[]) => Promise<void>): void {
    this.onConsolidate = handler;
  }

  async store(input: MemoryInput): Promise<string> {
    const id = crypto.randomUUID();
    const entry: WorkingEntry = {
      id,
      userId: input.userId,
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.5,
      createdAt: new Date(),
    };

    const session = this.sessions.get(input.userId) ?? [];

    if (session.length >= this.capacity) {
      // Evict least important entry before adding new one
      const minIdx = session.reduce(
        (min, e, i) => (e.importance < session[min]!.importance ? i : min),
        0
      );
      session.splice(minIdx, 1);
    }

    session.push(entry);
    this.sessions.set(input.userId, session);
    return id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const session = this.sessions.get(query.userId) ?? [];
    return session
      .slice(-(query.limit ?? this.capacity))
      .map((e) => this.toResult(e));
  }

  async consolidate(): Promise<ConsolidationResult> {
    let promoted = 0;
    let evicted = 0;

    for (const [userId, entries] of this.sessions) {
      const toPromote = entries.filter((e) => e.importance >= 0.6);
      const toLet = entries.filter((e) => e.importance < 0.6);

      if (toPromote.length > 0 && this.onConsolidate) {
        await this.onConsolidate(toPromote);
        promoted += toPromote.length;
      }

      evicted += toLet.length;
      this.sessions.set(userId, []);
    }

    return { promoted, evicted };
  }

  clearSession(userId: string): void {
    this.sessions.delete(userId);
  }

  private toResult(entry: WorkingEntry): MemoryResult {
    return {
      id: entry.id,
      layer: this.layer,
      content: entry.content,
      metadata: entry.metadata,
      importance: entry.importance,
      createdAt: entry.createdAt,
    };
  }
}
