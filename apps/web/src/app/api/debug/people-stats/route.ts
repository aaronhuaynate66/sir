import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  const { data: people } = await db
    .from('people')
    .select('id, name, email')
    .eq('user_id', user.id);

  const rows = (people ?? []) as Array<{ id: string; name: string; email: string | null }>;

  const total      = rows.length;
  const withEmail  = rows.filter(p => !!p.email).length;
  const withoutEmail = rows.filter(p => !p.email).length;

  const sampleWithEmail    = rows.filter(p => !!p.email).slice(0, 5).map(p => ({ name: p.name, email: p.email }));
  const sampleWithoutEmail = rows.filter(p => !p.email).slice(0, 5).map(p => p.name);

  return Response.json({
    total,
    with_email:    withEmail,
    without_email: withoutEmail,
    pct_with_email: total > 0 ? Math.round((withEmail / total) * 100) : 0,
    sample_with_email:    sampleWithEmail,
    sample_without_email: sampleWithoutEmail,
  });
}
