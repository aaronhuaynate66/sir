import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface PersonRow {
  id:   string;
  name: string;
  slug: string;
}

interface RelRow {
  id:                    string;
  person_id:             string;
  strength:              number;
  stage:                 string;
  last_contact_at:       string | null;
  contact_frequency_days: number | null;
}

interface SignalRow {
  person_id:  string | null;
  type:       string;
  payload:    Record<string, unknown>;
  created_at: string;
}

export async function GET(): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const now = Date.now();

  const [peopleRes, relsRes, signalsRes] = await Promise.all([
    db.from('people').select('id, name, slug').eq('user_id', user.id),
    db.from('relationships').select('id, person_id, strength, stage, last_contact_at, contact_frequency_days').eq('user_id', user.id),
    db.from('signals').select('person_id, type, payload, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000),
  ]);

  const people  = (peopleRes.data  ?? []) as PersonRow[];
  const rels    = (relsRes.data    ?? []) as RelRow[];
  const signals = (signalsRes.data ?? []) as SignalRow[];

  const personMap = new Map(people.map(p => [p.id, p]));
  const relMap    = new Map(rels.map(r => [r.person_id, r]));

  // Count sent/received interactions per person (signals of type 'interaction')
  const interactionSent     = new Map<string, number>();
  const interactionReceived = new Map<string, number>();

  for (const s of signals) {
    if (s.type !== 'interaction' || !s.person_id) continue;
    const initiated = s.payload['initiated_by'] === 'user';
    if (initiated) interactionSent.set(s.person_id, (interactionSent.get(s.person_id) ?? 0) + 1);
    else interactionReceived.set(s.person_id, (interactionReceived.get(s.person_id) ?? 0) + 1);
  }

  // Pending signals (unacted) — signals older than 7 days with no follow-up
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const pendingSignals = signals.filter(s =>
    s.created_at < sevenDaysAgo &&
    s.person_id &&
    s.type !== 'interaction'
  );

  // This month interaction counts
  const monthAgo = new Date(now - 30 * 86_400_000).toISOString();
  const monthlyInteractions = new Map<string, number>();
  for (const s of signals) {
    if (s.created_at < monthAgo || !s.person_id) continue;
    monthlyInteractions.set(s.person_id, (monthlyInteractions.get(s.person_id) ?? 0) + 1);
  }

  // Build results
  const atRisk: Array<{ id: string; name: string; slug: string; daysWithout: number; strength: number }> = [];
  const unbalanced: Array<{ id: string; name: string; slug: string; userSent: number; received: number }> = [];

  for (const rel of rels) {
    const person = personMap.get(rel.person_id);
    if (!person) continue;

    // At risk: no contact in 30+ days AND relationship strength > 20
    if (rel.last_contact_at) {
      const daysWithout = Math.floor((now - new Date(rel.last_contact_at).getTime()) / 86_400_000);
      if (daysWithout >= 30 && rel.strength > 20) {
        atRisk.push({ id: person.id, name: person.name, slug: person.slug, daysWithout, strength: rel.strength });
      }
    } else if (rel.strength > 20) {
      atRisk.push({ id: person.id, name: person.name, slug: person.slug, daysWithout: 999, strength: rel.strength });
    }

    // Unbalanced: user always initiates (3x more sent than received)
    const sent     = interactionSent.get(rel.person_id)     ?? 0;
    const received = interactionReceived.get(rel.person_id) ?? 0;
    if (sent >= 3 && sent > received * 2) {
      unbalanced.push({ id: person.id, name: person.name, slug: person.slug, userSent: sent, received });
    }
  }

  // Pending unacted signals (unique persons)
  const pendingByPerson = new Map<string, number>();
  for (const s of pendingSignals) {
    if (!s.person_id) continue;
    pendingByPerson.set(s.person_id, (pendingByPerson.get(s.person_id) ?? 0) + 1);
  }
  const pendingAttention = Array.from(pendingByPerson.entries())
    .map(([personId, count]) => {
      const p = personMap.get(personId);
      return p ? { id: p.id, name: p.name, slug: p.slug, pendingCount: count } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.pendingCount - a.pendingCount);

  // Most active this month — top 5
  const mostActive = [...monthlyInteractions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([personId, count]) => {
      const p = personMap.get(personId);
      const r = relMap.get(personId);
      return p ? { id: p.id, name: p.name, slug: p.slug, count, strength: r?.strength ?? 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return Response.json({
    at_risk:          atRisk.sort((a, b) => b.daysWithout - a.daysWithout),
    unbalanced:       unbalanced.sort((a, b) => b.userSent - a.userSent),
    pending_attention: pendingAttention,
    most_active:      mostActive,
    total_people:     people.length,
    at_risk_count:    atRisk.length,
  });
}
