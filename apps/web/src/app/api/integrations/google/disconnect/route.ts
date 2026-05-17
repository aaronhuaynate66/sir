import { type NextRequest } from 'next/server';
import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';
import { type GoogleIntegration } from '../_lib';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    // Disconnect a specific account
    const { data: intRow } = await db
      .from('google_integrations')
      .select('id, access_token, refresh_token')
      .eq('id', id)
      .eq('user_id', user.id) // ensure ownership
      .maybeSingle();

    if (!intRow) return Response.json({ ok: true });

    const integration = intRow as Pick<GoogleIntegration, 'id' | 'access_token' | 'refresh_token'>;
    const tokenToRevoke = integration.refresh_token ?? integration.access_token;
    if (tokenToRevoke) {
      fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
        { method: 'POST' }
      ).catch(() => undefined);
    }

    await db.from('google_integrations').delete().eq('id', id).eq('user_id', user.id);

    // If we deleted the primary account, promote the next one
    const { data: remaining } = await db
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    if (remaining && (remaining as unknown[]).length > 0) {
      const first = (remaining as Array<{ id: string }>)[0];
      if (first) {
        await db.from('google_integrations').update({ is_primary: true }).eq('id', first.id);
      }
    }
  } else {
    // Disconnect all accounts (legacy behavior)
    const { data: rows } = await db
      .from('google_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id);

    for (const row of (rows ?? []) as Array<Pick<GoogleIntegration, 'access_token' | 'refresh_token'>>) {
      const tokenToRevoke = row.refresh_token ?? row.access_token;
      if (tokenToRevoke) {
        fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
          { method: 'POST' }
        ).catch(() => undefined);
      }
    }
    await db.from('google_integrations').delete().eq('user_id', user.id);
  }

  return Response.json({ ok: true });
}
