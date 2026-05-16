import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getAppUrl, GOOGLE_OAUTH_CALLBACK_URL } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const appUrl = getAppUrl();

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', appUrl));

  // Use base64-encoded user id as state (lightweight CSRF check)
  const state = Buffer.from(user.id).toString('base64url');

  const params = new URLSearchParams({
    client_id:     process.env['GOOGLE_CLIENT_ID'] ?? '',
    redirect_uri:  GOOGLE_OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope:         [
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent',
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
