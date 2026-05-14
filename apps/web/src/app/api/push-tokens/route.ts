import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import { pushTokenSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw   = await req.json().catch(() => ({})) as unknown;
  const parse = pushTokenSchema.safeParse(raw);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.errors[0]?.message ?? 'Invalid token' }, { status: 400 });
  }
  const { token } = parse.data;

  const { error } = await getServiceClient()
    .from('users')
    .update({ expo_push_token: token })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
