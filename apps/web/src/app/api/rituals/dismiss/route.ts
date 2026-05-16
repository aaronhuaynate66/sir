import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  await getServiceClient()
    .from('ritual_suggestions')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  return Response.json({ ok: true });
}
