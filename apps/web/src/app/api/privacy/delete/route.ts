import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import { deleteAccountSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as unknown;
  const parse = deleteAccountSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Confirmation text required: ELIMINAR MI CUENTA' }, { status: 400 });
  }

  const db  = getServiceClient();
  const uid = user.id;

  // Delete in dependency order (FK constraints)
  const tables = [
    'analytics_events',
    'notification_logs',
    'briefings',
    'human_state_logs',
    'memories',
    'signals',
    'relationships',
    'people',
  ] as const;

  for (const table of tables) {
    const { error } = await db.from(table).delete().eq('user_id', uid);
    if (error && error.code !== '42P01') {
      // 42P01 = table does not exist → skip gracefully
      console.error(`[DELETE /api/privacy/delete] table ${table}:`, error.message);
    }
  }

  // Delete user record
  const { error: userError } = await db.from('users').delete().eq('id', uid);
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  // Sign out the session
  try {
    const anonClient = db; // service client can delete auth user
    await anonClient.auth.admin.deleteUser(uid);
  } catch {
    // non-critical — user data is gone, auth record cleanup is best-effort
  }

  return NextResponse.json({ ok: true });
}
