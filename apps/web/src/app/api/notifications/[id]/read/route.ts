import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await getServiceClient()
    .from('notification_logs')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id); // ensure ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  // Allow POST as alias (easier to call from client fetch)
  return PATCH(req, ctx);
}
