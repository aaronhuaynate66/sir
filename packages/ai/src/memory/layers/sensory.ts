import type { IConsolidatable, MemoryInput, MemoryQuery, MemoryResult, ConsolidationResult } from '../types';

const TTL_MS = 30_000;

interface SensoryEntry {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  expiresAt: number;
  createdAt: Date;
}

export class SensoryMemory implements IConsolidatable {
  readonly layer = 'sensory' as const;

  private buffer = new Map<string, SensoryEntry>();
  private onConsolidate?: (entries: SensoryEntry[]) => Promise<void>;

  constructor(
    private readonly ttlMs = TTL_MS,
    private readonly clock: () => number = Date.now
  ) {}

  setConsolidationHandler(handler: (entries: SensoryEntry[]) => Promise<void>): void {
    this.onConsolidate = handler;
  }

  async store(input: MemoryInput): Promise<string> {
    this.evictExpired();
    const id = crypto.randomUUID();
    this.buffer.set(id, {
      id,
      userId: input.userId,
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.3,
      expiresAt: this.clock() + this.ttlMs,
      createdAt: new Date(),
    });
    return id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    this.evictExpired();
    const now = this.clock();
    const results: MemoryResult[] = [];

    for (const entry of this.buffer.values()) {
      if (entry.userId !== query.userId) continue;
      if (entry.expiresAt <= now) continue;
      results.push(this.toResult(entry));
    }

    return results.slice(0, query.limit ?? 50);
  }

  async consolidate(): Promise<ConsolidationResult> {
    this.evictExpired();
    const important = [...this.buffer.values()].filter((e) => e.importance >= 0.5);

    if (important.length > 0 && this.onConsolidate) {
      await this.onConsolidate(important);
    }

    const evicted = this.buffer.size - important.length;
    for (const entry of important) {
      this.buffer.delete(entry.id);
    }
    this.buffer.clear();

    return { promoted: important.length, evicted };
  }

  private evictExpired(): void {
    const now = this.clock();
    for (const [id, entry] of this.buffer) {
      if (entry.expiresAt <= now) this.buffer.delete(id);
    }
  }

  private toResult(entry: SensoryEntry): MemoryResult {
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
