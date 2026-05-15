import { PostHog } from 'posthog-node';
import { getSupabaseClient } from '@sir/db';

const POSTHOG_HOST = 'https://us.i.posthog.com';

export function trackServerEvent(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
): void {
  // Supabase — fire and forget, non-blocking
  getSupabaseClient()
    .from('analytics_events')
    .insert({ user_id: userId, event_name: event, properties })
    .then(undefined, () => undefined);

  // PostHog — optional, per-call client for serverless reliability
  const key = process.env['POSTHOG_KEY'] ?? process.env['NEXT_PUBLIC_POSTHOG_KEY'];
  if (key) {
    try {
      const client = new PostHog(key, { host: POSTHOG_HOST, flushAt: 1, flushInterval: 0 });
      client.capture({ distinctId: userId, event, properties });
      client.shutdown().catch(() => undefined);
    } catch { /* non-critical */ }
  }
}
