import { createMemory, getMemoriesByLayer } from '@sir/db';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export class EpisodicMemory implements IMemoryLayer {
  readonly layer = 'episodic' as const;

  async store(input: MemoryInput): Promise<string> {
    const memory = await createMemory({
      user_id: input.userId,
      layer: 'episodic',
      content: input.content,
      metadata: {
        ...input.metadata,
        recordedAt: new Date().toISOString(),
      },
      importance: input.importance ?? 0.5,
    });
    return memory.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const memories = await getMemoriesByLayer(query.userId, 'episodic', query.limit ?? 20);

    return memories
      .filter((m) => {
        if (!query.timeRange) return true;
        const created = new Date(m.created_at);
        return created >= query.timeRange.from && created <= query.timeRange.to;
      })
      .map((m) => ({
        id: m.id,
        layer: this.layer,
        content: m.content,
        metadata: m.metadata,
        importance: m.importance,
        createdAt: new Date(m.created_at),
      }));
  }
}
