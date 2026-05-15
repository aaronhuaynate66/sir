import type { SupabaseClient } from '@supabase/supabase-js';

interface LimitResult { success: boolean }
type Limiter = { limit: (id: string) => Promise<LimitResult> };

const cache = new Map<string, Limiter>();

export async function checkRateLimit(
  identifier: string,
  requests: number,
  window: string,
): Promise<Response | null> {
  const url   = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;

  try {
    const key = `${requests}/${window}`;
    if (!cache.has(key)) {
      const [{ Ratelimit }, { Redis }] = await Promise.all([
        import('@upstash/ratelimit'),
        import('@upstash/redis'),
      ]);
      cache.set(key, new Ratelimit({
        redis:   new Redis({ url, token }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        limiter: Ratelimit.slidingWindow(requests, window as any),
      }));
    }
    const { success } = await cache.get(key)!.limit(identifier);
    if (!success) {
      return Response.json({ error: 'Too many requests' }, {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }
    return null;
  } catch {
    return null;
  }
}

// ── AI hourly rate limit (20 AI calls/hour tracked via Supabase analytics_events) ──

const AI_HOURLY_LIMIT = 20;
const AI_EVENT_NAMES  = ['briefing_generated', 'signal_created', 'state_logged'];

export async function checkAIHourlyLimit(
  userId: string,
  db: SupabaseClient,
): Promise<Response | null> {
  try {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('event_name', AI_EVENT_NAMES)
      .gte('created_at', hourAgo);

    if ((count ?? 0) >= AI_HOURLY_LIMIT) {
      return Response.json(
        { error: `Límite de IA: ${AI_HOURLY_LIMIT} requests por hora. Intenta de nuevo más tarde.` },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    }
    return null;
  } catch {
    return null;
  }
}

// ── Briefing plan limits (free: 5 total | individual/pro: 50/month) ───────────

const PLAN_LIMITS: Record<string, { max: number; monthly: boolean }> = {
  free:       { max: 5,   monthly: false },
  individual: { max: 50,  monthly: true  },
  pro:        { max: 50,  monthly: true  },
  enterprise: { max: 500, monthly: true  },
};

export async function checkBriefingMonthlyLimit(
  userId: string,
  db: SupabaseClient,
): Promise<Response | null> {
  try {
    const { data: userData } = await db
      .from('users')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    const status   = (userData as { subscription_status?: string } | null)?.subscription_status ?? 'free';
    const planCfg  = PLAN_LIMITS[status] ?? PLAN_LIMITS['free']!;

    let query = db
      .from('briefings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (planCfg.monthly) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      query = query.gte('created_at', monthStart.toISOString());
    }

    const { count } = await query;

    if ((count ?? 0) >= planCfg.max) {
      const period = planCfg.monthly ? 'este mes' : 'en total';
      return Response.json(
        {
          error: `Límite de briefings: ${count}/${planCfg.max} ${period} (plan ${status}). ${planCfg.monthly ? 'Se reinicia el 1 del mes.' : 'Actualiza tu plan para continuar.'}`,
          limit: planCfg.max,
          used:  count,
          plan:  status,
        },
        { status: 429, headers: { 'Retry-After': planCfg.monthly ? '86400' : '0' } },
      );
    }
    return null;
  } catch {
    return null;
  }
}
