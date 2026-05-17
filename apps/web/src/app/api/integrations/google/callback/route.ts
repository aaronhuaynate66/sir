import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';
import { getAppUrl, GOOGLE_OAUTH_CALLBACK_URL } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const appUrl  = getAppUrl();
  const base    = (path: string) => new URL(path, appUrl);
  const { searchParams } = req.nextUrl;

  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(base('/config/integraciones?error=cancelled'));
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(base('/login'));

  // Verify state
  const expectedState = Buffer.from(user.id).toString('base64url');
  if (state !== expectedState) {
    return NextResponse.redirect(base('/config/integraciones?error=invalid_state'));
  }

  // Exchange code → tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env['GOOGLE_CLIENT_ID']!,
      client_secret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirect_uri:  GOOGLE_OAUTH_CALLBACK_URL,
      grant_type:    'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.redirect(base('/config/integraciones?error=token_exchange_failed'));
  }

  // Fetch account info from Google
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = userinfoRes.ok
    ? await userinfoRes.json() as { email?: string; name?: string }
    : {};

  const accountEmail = userinfo.email ?? null;
  const accountName  = userinfo.name  ?? null;
  const expiry       = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  const scopes       = (tokens.scope ?? 'contacts.readonly calendar.readonly')
    .split(' ')
    .map((s: string) => { const p = s.split('/auth/'); return p.length > 1 ? (p[1] ?? s) : s; })
    .filter(Boolean);

  const db = getServiceClient();

  // Find existing row: exact email match first, then legacy null-email row
  let existingId: string | null = null;
  if (accountEmail) {
    const { data: exact } = await db
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_email', accountEmail)
      .maybeSingle();
    if (exact) existingId = (exact as { id: string }).id;
  }
  if (!existingId) {
    const { data: legacy } = await db
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .is('account_email', null)
      .maybeSingle();
    if (legacy) existingId = (legacy as { id: string }).id;
  }

  const payload = {
    user_id:       user.id,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expiry:  expiry.toISOString(),
    scopes,
    account_email: accountEmail,
    account_name:  accountName,
  };

  if (existingId) {
    await db.from('google_integrations').update(payload).eq('id', existingId);
  } else {
    // First account for this user → mark as primary
    const { data: anyExisting } = await db
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    const isPrimary = !anyExisting || (anyExisting as unknown[]).length === 0;
    await db.from('google_integrations').insert({ ...payload, is_primary: isPrimary });
  }

  const finalUrl = `${getAppUrl()}/config/integraciones?connected=google`;
  return NextResponse.redirect(finalUrl);
}
