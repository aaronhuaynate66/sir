import { getSupabaseClient } from '../supabase';
import { syncRelationshipToNeo4j } from '../neo4j';
import { findPersonById } from './people';
import type { DbRelationship, InsertRelationship, RelationshipStage } from '../schema';

async function _syncToNeo4j(rel: DbRelationship): Promise<void> {
  const person = await findPersonById(rel.person_id);
  if (!person) return;
  await syncRelationshipToNeo4j(rel.user_id, person, rel);
}

export async function createRelationship(data: InsertRelationship): Promise<DbRelationship> {
  const { data: rel, error } = await getSupabaseClient()
    .from('relationships')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`createRelationship: ${error.message}`);
  const result = rel as DbRelationship;

  _syncToNeo4j(result).catch(() => undefined);
  return result;
}

export async function updateRelationship(
  id: string,
  data: Partial<Pick<DbRelationship,
    'strength' | 'reciprocity' | 'trust_score' | 'relationship_type' |
    'last_contact_at' | 'contact_frequency_days' | 'stage'
  >>
): Promise<DbRelationship> {
  const { data: rel, error } = await getSupabaseClient()
    .from('relationships')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`updateRelationship: ${error.message}`);
  const result = rel as DbRelationship;

  _syncToNeo4j(result).catch(() => undefined);
  return result;
}

export async function findRelationshipsByUserId(
  userId: string,
  limit = 100
): Promise<DbRelationship[]> {
  const { data, error } = await getSupabaseClient()
    .from('relationships')
    .select()
    .eq('user_id', userId)
    .order('strength', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`findRelationshipsByUserId: ${error.message}`);
  return (data ?? []) as DbRelationship[];
}

export async function findRelationshipByPersonId(
  userId: string,
  personId: string
): Promise<DbRelationship | null> {
  const { data, error } = await getSupabaseClient()
    .from('relationships')
    .select()
    .eq('user_id', userId)
    .eq('person_id', personId)
    .maybeSingle();

  if (error) throw new Error(`findRelationshipByPersonId: ${error.message}`);
  return data as DbRelationship | null;
}

export async function updateStrength(
  id: string,
  strength: number,
  reciprocity?: number
): Promise<DbRelationship> {
  const patch: Partial<DbRelationship> = { strength };
  if (reciprocity !== undefined) patch.reciprocity = reciprocity;
  return updateRelationship(id, patch);
}

export interface RelationshipScore {
  overall: number;      // 0-100 composite score
  strength: number;
  reciprocity: number;
  trust: number;        // trust_score * 100
  stage: RelationshipStage;
}

export async function getRelationshipScore(
  userId: string,
  personId: string
): Promise<RelationshipScore | null> {
  const rel = await findRelationshipByPersonId(userId, personId);
  if (!rel) return null;

  const overall = Math.round(
    rel.strength * 0.4 +
    rel.reciprocity * 0.3 +
    rel.trust_score * 100 * 0.3
  );

  return {
    overall,
    strength: rel.strength,
    reciprocity: rel.reciprocity,
    trust: Math.round(rel.trust_score * 100),
    stage: rel.stage,
  };
}

export async function deleteRelationship(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('relationships')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`deleteRelationship: ${error.message}`);
}
