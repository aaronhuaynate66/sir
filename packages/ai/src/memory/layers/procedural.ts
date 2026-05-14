import { createMemory, getMemoriesByLayer } from '@sir/db';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export interface ProceduralMetadata {
  routineType: string;
  triggerCondition?: string;
  successCount?: number;
  lastExecutedAt?: string;
}

export class ProceduralMemory implements IMemoryLayer {
  readonly layer = 'procedural' as const;

  async store(input: MemoryInput): Promise<string> {
    const memory = await createMemory({
      user_id: input.userId,
      layer: 'procedural',
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.6,
    });
    return memory.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const memories = await getMemoriesByLayer(query.userId, 'procedural', query.limit ?? 20);

    return memories.map((m) => ({
      id: m.id,
      layer: this.layer,
      content: m.content,
      metadata: m.metadata,
      importance: m.importance,
      createdAt: new Date(m.created_at),
    }));
  }
}
