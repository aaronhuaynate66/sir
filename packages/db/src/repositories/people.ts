import { getSupabaseClient } from '../supabase';
import { syncPersonToNeo4j } from '../neo4j';
import type { DbPerson, InsertPerson } from '../schema';

export async function createPerson(data: InsertPerson): Promise<DbPerson> {
  const { data: person, error } = await getSupabaseClient()
    .from('people')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`createPerson: ${error.message}`);
  const result = person as DbPerson;

  // Sync to Neo4j — non-blocking: failure doesn't fail the write
  syncPersonToNeo4j(result).catch(() => undefined);

  return result;
}

export async function updatePerson(
  id: string,
  data: Partial<Pick<DbPerson,
    'name' | 'email' | 'phone' | 'organization' | 'role' |
    'linkedin_url' | 'instagram_url' | 'avatar_url' | 'notes' | 'tags' | 'language' |
    'relationship_type' | 'birthday' | 'anniversary'
  >>
): Promise<DbPerson> {
  const { data: person, error } = await getSupabaseClient()
    .from('people')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`updatePerson: ${error.message}`);
  const result = person as DbPerson;

  syncPersonToNeo4j(result).catch(() => undefined);
  return result;
}

export async function findPersonById(id: string): Promise<DbPerson | null> {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select()
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`findPersonById: ${error.message}`);
  return data as DbPerson | null;
}

export async function findPeopleByUserId(userId: string, limit = 100): Promise<DbPerson[]> {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select()
    .eq('user_id', userId)
    .order('name')
    .limit(limit);

  if (error) throw new Error(`findPeopleByUserId: ${error.message}`);
  return (data ?? []) as DbPerson[];
}

export async function searchPeople(
  userId: string,
  query: string,
  limit = 20
): Promise<DbPerson[]> {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select()
    .eq('user_id', userId)
    .or(`name.ilike.%${query}%,organization.ilike.%${query}%,email.ilike.%${query}%`)
    .order('name')
    .limit(limit);

  if (error) throw new Error(`searchPeople: ${error.message}`);
  return (data ?? []) as DbPerson[];
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('people')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`deletePerson: ${error.message}`);
}
