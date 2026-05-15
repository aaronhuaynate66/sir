'use server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export async function updatePersonStage(personId: string, newStage: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');
  const db = getServiceClient();
  await db.from('relationships').update({ stage: newStage }).eq('person_id', personId).eq('user_id', user.id);
}
