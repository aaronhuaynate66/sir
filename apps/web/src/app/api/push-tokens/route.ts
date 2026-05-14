import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await req.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>)['token'] !== 'string'
  ) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const token = (body as Record<string, string | undefined>)['token'];
  if (!token || !token.startsWith('ExponentPushToken[')) {
    return NextResponse.json({ error: 'Invalid Expo push token format' }, { status: 400 });
  }

  const { error } = await getServiceClient()
    .from('users')
    .update({ expo_push_token: token })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
