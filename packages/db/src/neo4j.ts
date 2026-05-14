import neo4j, { Driver } from 'neo4j-driver';
import type { Neo4jConfig } from './types';
import type { DbPerson, DbRelationship } from './schema';

let _driver: Driver | null = null;

export function getNeo4jDriver(config?: Neo4jConfig): Driver {
  if (_driver) return _driver;

  const uri = config?.uri ?? process.env['NEO4J_URI'] ?? 'bolt://localhost:7687';
  const user = config?.user ?? process.env['NEO4J_USER'] ?? 'neo4j';
  const password = config?.password ?? process.env['NEO4J_PASSWORD'];

  if (!password) throw new Error('Missing NEO4J_PASSWORD');

  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  return _driver;
}

export async function closeNeo4jDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

// Crea o actualiza un nodo Person en Neo4j
export async function syncPersonToNeo4j(person: DbPerson): Promise<void> {
  const session = getNeo4jDriver().session();
  try {
    await session.run(
      `MERGE (p:Person {supabaseId: $id})
       SET p.name = $name,
           p.email = $email,
           p.organization = $organization,
           p.role = $role,
           p.userId = $userId,
           p.updatedAt = datetime()`,
      {
        id: person.id,
        name: person.name,
        email: person.email ?? null,
        organization: person.organization ?? null,
        role: person.role ?? null,
        userId: person.user_id,
      }
    );

    // Si tiene organización, crea nodo Organization y relación WORKS_AT
    if (person.organization) {
      await session.run(
        `MERGE (o:Organization {name: $org})
         WITH o
         MATCH (p:Person {supabaseId: $personId})
         MERGE (p)-[:WORKS_AT]->(o)`,
        { org: person.organization, personId: person.id }
      );
    }
  } finally {
    await session.close();
  }
}

// Sincroniza una relación Supabase → KNOWS en Neo4j
export async function syncRelationshipToNeo4j(
  ownerUserId: string,
  person: DbPerson,
  rel: DbRelationship
): Promise<void> {
  const session = getNeo4jDriver().session();
  try {
    // Asegura que exista el nodo del owner (puede no tener registro en people)
    await session.run(
      `MERGE (owner:Person {supabaseId: $ownerId})
       SET owner.userId = $ownerId, owner.updatedAt = datetime()`,
      { ownerId: ownerUserId }
    );

    await session.run(
      `MATCH (owner:Person {supabaseId: $ownerId})
       MATCH (contact:Person {supabaseId: $personId})
       MERGE (owner)-[r:KNOWS]->(contact)
       SET r.strength     = $strength,
           r.reciprocity  = $reciprocity,
           r.trustScore   = $trustScore,
           r.type         = $type,
           r.stage        = $stage,
           r.updatedAt    = datetime()`,
      {
        ownerId: ownerUserId,
        personId: person.id,
        strength: neo4j.int(rel.strength),
        reciprocity: neo4j.int(rel.reciprocity),
        trustScore: rel.trust_score,
        type: rel.relationship_type,
        stage: rel.stage,
      }
    );
  } finally {
    await session.close();
  }
}

export interface NetworkDepth {
  firstDegree: number;
  secondDegree: number;
}

// Cuenta conexiones de 1er y 2do grado para un userId
export async function getNetworkDepth(userId: string): Promise<NetworkDepth> {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:Person {userId: $userId})
       OPTIONAL MATCH (u)-[:KNOWS]-(first)
         WHERE first.supabaseId <> u.supabaseId
       OPTIONAL MATCH (first)-[:KNOWS]-(second)
         WHERE second.userId <> $userId
           AND second.supabaseId <> u.supabaseId
       RETURN
         count(DISTINCT first)  AS firstDegree,
         count(DISTINCT second) AS secondDegree`,
      { userId }
    );

    const record = result.records[0];
    if (!record) return { firstDegree: 0, secondDegree: 0 };

    return {
      firstDegree:  (record.get('firstDegree')  as { toNumber(): number }).toNumber(),
      secondDegree: (record.get('secondDegree') as { toNumber(): number }).toNumber(),
    };
  } finally {
    await session.close();
  }
}
