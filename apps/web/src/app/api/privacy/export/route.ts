import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db  = getServiceClient();
  const uid = user.id;

  const [people, signals, relationships, memories, humanStates, notifications, analytics] =
    await Promise.all([
      db.from('people').select('*').eq('user_id', uid),
      db.from('signals').select('*').eq('user_id', uid),
      db.from('relationships').select('*').eq('user_id', uid),
      db.from('memories').select('id, layer, content, importance, metadata, created_at').eq('user_id', uid),
      db.from('human_state_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
      db.from('notification_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
      db.from('analytics_events').select('event_name, properties, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000),
    ]);

  const payload = {
    exported_at:   new Date().toISOString(),
    user_id:       uid,
    email:         user.email,
    people:        people.data        ?? [],
    signals:       signals.data       ?? [],
    relationships: relationships.data ?? [],
    memories:      memories.data      ?? [],
    human_states:  humanStates.data   ?? [],
    notifications: notifications.data ?? [],
    analytics:     analytics.data     ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="sir-export-${date}.json"`,
      'Cache-Control':       'no-store',
    },
  });
}
