import { createMemory, getMemoriesByLayer } from '@sir/db';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export interface PropheticMetadata {
  confidence: number; // 0-1
  horizon: 'short' | 'medium' | 'long'; // días / semanas / meses
  patternSource: string;
  validUntil?: string;
}

export class PropheticMemory implements IMemoryLayer {
  readonly layer = 'prophetic' as const;

  async store(input: MemoryInput): Promise<string> {
    const memory = await createMemory({
      user_id: input.userId,
      layer: 'prophetic',
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.4,
    });
    return memory.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const memories = await getMemoriesByLayer(query.userId, 'prophetic', query.limit ?? 10);

    return memories
      .filter((m) => {
        const meta = m.metadata as unknown as PropheticMetadata;
        if (!meta.validUntil) return true;
        return new Date(meta.validUntil) > new Date();
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
