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
