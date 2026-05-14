import { createMemory, getMemoriesByLayer } from '@sir/db';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export type EmotionType =
  | 'joy' | 'sadness' | 'anger' | 'fear'
  | 'surprise' | 'disgust' | 'trust' | 'anticipation';

export interface EmotionalMetadata {
  emotion: EmotionType;
  intensity: number; // 0-1
  context?: string;
}

export class EmotionalMemory implements IMemoryLayer {
  readonly layer = 'emotional' as const;

  async store(input: MemoryInput): Promise<string> {
    const memory = await createMemory({
      user_id: input.userId,
      layer: 'emotional',
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.5,
    });
    return memory.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const memories = await getMemoriesByLayer(query.userId, 'emotional', query.limit ?? 20);

    const filtered = query.metadata?.emotion
      ? memories.filter((m) => (m.metadata as unknown as EmotionalMetadata).emotion === query.metadata?.emotion)
      : memories;

    return filtered.map((m) => ({
      id: m.id,
      layer: this.layer,
      content: m.content,
      metadata: m.metadata,
      importance: m.importance,
      createdAt: new Date(m.created_at),
    }));
  }
}

// Extend MemoryQuery to allow metadata filtering
declare module '../types' {
  interface MemoryQuery {
    metadata?: Record<string, unknown>;
  }
}
