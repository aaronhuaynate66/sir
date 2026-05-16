import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface HealthBreakdown {
  frequency:   number;
  reciprocity: number;
  quality:     number;
  signals:     number;
  total:       number;
}

function computeHealth(opts: {
  rel: { strength: number; reciprocity: number; contact_frequency_days: number | null; last_contact_at: string | null } | null;
  interactionCount:       number;
  userInitiated:          number;
  avgInteractionQuality:  number | null;
  signalCount:            number;
  actedSignalCount:       number;
  expectedFrequencyDays:  number;
}): HealthBreakdown {
  const { rel, interactionCount, userInitiated, avgInteractionQuality, signalCount, actedSignalCount, expectedFrequencyDays } = opts;

  // 30% — Frequency vs expected
  let frequencyScore = 0;
  if (rel?.last_contact_at) {
    const daysSince = (Date.now() - new Date(rel.last_contact_at).getTime()) / 86_400_000;
    frequencyScore = Math.max(0, Math.min(100, 100 - (daysSince / expectedFrequencyDays) * 50));
  } else {
    frequencyScore = interactionCount > 0 ? 30 : 0;
  }

  // 25% — Reciprocity (50/50 is ideal, all one-sided is 0)
  const reciprocityScore = rel?.reciprocity
    ? Math.min(100, rel.reciprocity)
    : interactionCount > 0
      ? Math.max(0, 100 - Math.abs(userInitiated - (interactionCount - userInitiated)) / Math.max(1, interactionCount) * 100)
      : 50;

  // 25% — Quality of interactions
  const qualityScore = avgInteractionQuality !== null
    ? Math.min(100, (avgInteractionQuality / 5) * 100)
    : rel?.strength ? Math.min(100, rel.strength) : 50;

  // 20% — Signals acted upon (% of signals with follow-up)
  const signalsScore = signalCount > 0
    ? Math.min(100, (actedSignalCount / signalCount) * 100)
    : 70; // neutral if no signals

  const total = Math.round(
    frequencyScore  * 0.30 +
    reciprocityScore * 0.25 +
    qualityScore    * 0.25 +
    signalsScore    * 0.20
  );

  return {
    frequency:   Math.round(frequencyScore),
    reciprocity: Math.round(reciprocityScore),
    quality:     Math.round(qualityScore),
    signals:     Math.round(signalsScore),
    total,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const personId = params.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const [relRes, signalsRes, signalsPrevRes] = await Promise.all([
    db.from('relationships')
      .select('strength, reciprocity, trust_score, contact_frequency_days, last_contact_at')
      .eq('user_id', user.id).eq('person_id', personId).single(),
    db.from('signals')
      .select('type, payload, created_at')
      .eq('user_id', user.id).eq('person_id', personId)
      .gte('created_at', thirtyDaysAgo),
    db.from('signals')
      .select('type, payload, created_at')
      .eq('user_id', user.id).eq('person_id', personId)
      .gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
  ]);

  type RelData = { strength: number; reciprocity: number; trust_score: number; contact_frequency_days: number | null; last_contact_at: string | null };
  type SigData = { type: string; payload: Record<string, unknown>; created_at: string };

  const rel = relRes.data as RelData | null;

  const signals     = (signalsRes.data     ?? []) as SigData[];
  const prevSignals = (signalsPrevRes.data ?? []) as SigData[];

  // Current period stats
  const interactions    = signals.filter(s => s.type === 'interaction');
  const userInitiated   = interactions.filter(s => s.payload['initiated_by'] === 'user').length;
  const qualities       = interactions.map(s => typeof s.payload['quality'] === 'number' ? s.payload['quality'] as number : null).filter((q): q is number => q !== null);
  const avgQuality      = qualities.length > 0 ? qualities.reduce((a, b) => a + b, 0) / qualities.length : null;
  const nonInteractions = signals.filter(s => s.type !== 'interaction');
  const actedSignals    = nonInteractions.filter(s => s.payload['acted'] === true).length;
  const expectedFreq    = rel?.contact_frequency_days ?? 30;

  const current = computeHealth({
    rel, interactionCount: interactions.length, userInitiated,
    avgInteractionQuality: avgQuality, signalCount: nonInteractions.length,
    actedSignalCount: actedSignals, expectedFrequencyDays: expectedFreq,
  });

  // Previous period for trend
  const prevInteractions  = prevSignals.filter(s => s.type === 'interaction');
  const prevUserInit      = prevInteractions.filter(s => s.payload['initiated_by'] === 'user').length;
  const prevQualities     = prevInteractions.map(s => typeof s.payload['quality'] === 'number' ? s.payload['quality'] as number : null).filter((q): q is number => q !== null);
  const prevAvgQuality    = prevQualities.length > 0 ? prevQualities.reduce((a, b) => a + b, 0) / prevQualities.length : null;
  const prevNonInt        = prevSignals.filter(s => s.type !== 'interaction');
  const prevActed         = prevNonInt.filter(s => s.payload['acted'] === true).length;

  const previous = computeHealth({
    rel, interactionCount: prevInteractions.length, userInitiated: prevUserInit,
    avgInteractionQuality: prevAvgQuality, signalCount: prevNonInt.length,
    actedSignalCount: prevActed, expectedFrequencyDays: expectedFreq,
  });

  const trend = current.total - previous.total;

  return Response.json({
    current,
    previous,
    trend,
    trend_label: trend > 5 ? 'mejorando' : trend < -5 ? 'deteriorando' : 'estable',
  });
}
