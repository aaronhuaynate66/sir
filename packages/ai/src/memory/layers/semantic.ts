import { createMemory, updateMemoryEmbedding, searchMemories } from '@sir/db';
import type { AIClient } from '../../types';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export class SemanticMemory implements IMemoryLayer {
  readonly layer = 'semantic' as const;

  constructor(private readonly ai: AIClient) {}

  async store(input: MemoryInput): Promise<string> {
    const memory = await createMemory({
      user_id: input.userId,
      layer: 'semantic',
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.7,
    });

    // Generate and store embedding asynchronously — non-blocking for the caller
    this.generateAndStoreEmbedding(memory.id, input.content).catch(() => {
      // Embedding failure is non-fatal; search will skip entries without embeddings
    });

    return memory.id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    if (!query.text) return [];

    const { embedding } = await this.ai.embed({ text: query.text });

    const results = await searchMemories(query.userId, embedding, {
      layer: 'semantic',
      limit: query.limit ?? 10,
      threshold: 0.7,
    });

    return results.map((r) => ({
      id: r.id,
      layer: this.layer,
      content: r.content,
      metadata: r.metadata,
      importance: r.importance,
      similarity: r.similarity,
      createdAt: new Date(r.created_at),
    }));
  }

  private async generateAndStoreEmbedding(memoryId: string, content: string): Promise<void> {
    const { embedding } = await this.ai.embed({ text: content });
    await updateMemoryEmbedding(memoryId, embedding);
  }
}
