import { getNeo4jDriver } from '@sir/db';
import type { IMemoryLayer, MemoryInput, MemoryQuery, MemoryResult } from '../types';

export interface SocialMetadata {
  relatedUserId: string;
  relationshipType: 'KNOWS' | 'WORKS_WITH' | 'FAMILY' | 'FRIEND' | 'ACQUAINTANCE';
  strength?: number; // 0-1
  interactions?: number;
}

export class SocialMemory implements IMemoryLayer {
  readonly layer = 'social' as const;

  async store(input: MemoryInput): Promise<string> {
    const meta = input.metadata as SocialMetadata | undefined;
    if (!meta?.relatedUserId) {
      throw new Error('SocialMemory.store requires metadata.relatedUserId');
    }

    const driver = getNeo4jDriver();
    const session = driver.session();
    const id = crypto.randomUUID();

    try {
      await session.run(
        `
        MERGE (a:Person {userId: $userId})
        MERGE (b:Person {userId: $relatedUserId})
        MERGE (a)-[r:${meta.relationshipType ?? 'KNOWS'}]->(b)
        ON CREATE SET
          r.id = $id,
          r.strength = $strength,
          r.interactions = 1,
          r.content = $content,
          r.createdAt = datetime()
        ON MATCH SET
          r.interactions = r.interactions + 1,
          r.strength = $strength,
          r.updatedAt = datetime()
        RETURN r.id as id
        `,
        {
          userId: input.userId,
          relatedUserId: meta.relatedUserId,
          id,
          strength: meta.strength ?? 0.5,
          content: input.content,
        }
      );
    } finally {
      await session.close();
    }

    return id;
  }

  async retrieve(query: MemoryQuery): Promise<MemoryResult[]> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (a:Person {userId: $userId})-[r]->(b:Person)
        RETURN
          r.id as id,
          b.userId as relatedUserId,
          type(r) as relationshipType,
          r.strength as strength,
          r.interactions as interactions,
          r.content as content,
          r.createdAt as createdAt
        ORDER BY r.strength DESC
        LIMIT $limit
        `,
        { userId: query.userId, limit: query.limit ?? 20 }
      );

      return result.records.map((record) => ({
        id: record.get('id') as string,
        layer: this.layer,
        content: record.get('content') as string ?? '',
        metadata: {
          relatedUserId: record.get('relatedUserId') as string,
          relationshipType: record.get('relationshipType') as string,
          strength: record.get('strength') as number,
          interactions: record.get('interactions') as number,
        },
        importance: record.get('strength') as number ?? 0.5,
        createdAt: new Date(record.get('createdAt') as string),
      }));
    } finally {
      await session.close();
    }
  }
}
