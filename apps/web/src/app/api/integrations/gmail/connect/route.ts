import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getAppUrl, getCallbackUrl } from '../../google/_lib';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const appUrl = getAppUrl();
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', appUrl));

  const state = Buffer.from(user.id).toString('base64url');

  const params = new URLSearchParams({
    client_id:     process.env['GOOGLE_CLIENT_ID'] ?? '',
    redirect_uri:  getCallbackUrl(),
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent',
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
