import { getServiceClient } from '@/lib/supabase-server';

export interface GoogleIntegration {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  scopes: string[];
  last_sync_at: string | null;
  contacts_synced: number;
  events_synced: number;
  emails_synced: number;
  gmail_last_sync_at: string | null;
  account_email: string | null;
  account_name: string | null;
  is_primary: boolean;
  created_at: string;
}

export function getAppUrl(): string {
  return process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sir-web.vercel.app';
}

// Always points to the Vercel deployment — must match what's registered in Google Cloud Console.
export const GOOGLE_OAUTH_CALLBACK_URL = 'https://sir-web.vercel.app/api/integrations/google/callback';

/** @deprecated Use GOOGLE_OAUTH_CALLBACK_URL directly. */
export function getCallbackUrl(): string {
  return GOOGLE_OAUTH_CALLBACK_URL;
}

/** Returns a valid access token, refreshing if expired (5-min buffer). */
export async function getValidToken(integration: GoogleIntegration, _userId: string): Promise<string> {
  const expiry = integration.token_expiry ? new Date(integration.token_expiry) : null;
  const isExpired = !expiry || expiry.getTime() - Date.now() < 5 * 60 * 1000;
  if (!isExpired) return integration.access_token;
  if (!integration.refresh_token) throw new Error('No refresh token — user must reconnect');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env['GOOGLE_CLIENT_ID']!,
      client_secret: process.env['GOOGLE_CLIENT_SECRET']!,
      refresh_token: integration.refresh_token,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error ?? 'unknown'}`);
  }

  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await getServiceClient()
    .from('google_integrations')
    .update({ access_token: data.access_token, token_expiry: newExpiry.toISOString() })
    .eq('id', integration.id);

  return data.access_token;
}
