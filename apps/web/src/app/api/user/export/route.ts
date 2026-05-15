import { getUserFromRequest, AuthError } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase-server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    const userId = await getUserFromRequest(req);
    const db     = getServiceClient();

    const [
      { data: profile },
      { data: people },
      { data: relationships },
      { data: memories },
      { data: signals },
      { data: briefings },
      { data: states },
      { data: analytics },
      { data: notifications },
    ] = await Promise.all([
      db.from('users').select('id, email, name, preferences, created_at').eq('id', userId).single(),
      db.from('people').select('*').eq('user_id', userId),
      db.from('relationships').select('*').eq('user_id', userId),
      db.from('memories').select('id, layer, content, importance, created_at').eq('user_id', userId),
      db.from('signals').select('id, type, payload, created_at').eq('user_id', userId),
      db.from('briefings').select('id, person_id, content, created_at').eq('user_id', userId),
      db.from('human_state_logs').select('*').eq('user_id', userId),
      db.from('analytics_events').select('event_name, properties, created_at').eq('user_id', userId),
      db.from('notification_logs').select('id, type, title, body, status, created_at').eq('user_id', userId),
    ]);

    await db.from('audit_log').insert({
      user_id:  userId,
      action:   'export_data',
      metadata: { exported_at: new Date().toISOString() },
    });

    const zip = new JSZip();
    zip.file('profile.json',       JSON.stringify(profile,            null, 2));
    zip.file('people.json',        JSON.stringify(people         ?? [], null, 2));
    zip.file('relationships.json', JSON.stringify(relationships   ?? [], null, 2));
    zip.file('memories.json',      JSON.stringify(memories        ?? [], null, 2));
    zip.file('signals.json',       JSON.stringify(signals         ?? [], null, 2));
    zip.file('briefings.json',     JSON.stringify(briefings       ?? [], null, 2));
    zip.file('human_states.json',  JSON.stringify(states          ?? [], null, 2));
    zip.file('analytics.json',     JSON.stringify(analytics       ?? [], null, 2));
    zip.file('notifications.json', JSON.stringify(notifications   ?? [], null, 2));

    const content = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': 'attachment; filename="sir-data-export.zip"',
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[GET /api/user/export]', err);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
