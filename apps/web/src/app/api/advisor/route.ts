import { NextResponse } from 'next/server';
import { getUserFromRequest, AuthError } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MS_DAY = 86_400_000;
const DEFAULT_FREQUENCY_DAYS = 30;

interface RelWithPerson {
  id: string;
  person_id: string;
  strength: number;
  reciprocity: number;
  trust_score: number;
  stage: string;
  last_contact_at: string | null;
  contact_frequency_days: number | null;
  people: {
    id: string;
    name: string;
    organization: string | null;
    role: string | null;
  } | null;
}

interface HumanStateRow {
  availability_score: number;
  interaction_risk: number;
  composite_score: number;
}

export interface AdvisorSuggestion {
  person_id: string;
  person_name: string;
  person_org: string | null;
  urgency: 'high' | 'medium' | 'low';
  contact_score: number;
  reason: string;
  last_contact_at: string | null;
  days_since_contact: number | null;
  relationship_score: number;
}

function compositeRelScore(r: RelWithPerson): number {
  return Math.round(r.strength * 0.4 + r.reciprocity * 0.3 + r.trust_score * 100 * 0.3);
}

const STAGE_URGENCY: Record<string, number> = {
  dormant:   80,
  prospect:  50,
  active:    20,
  strategic: 15,
};

function buildSuggestion(
  rel: RelWithPerson,
  humanState: HumanStateRow | null
): AdvisorSuggestion | null {
  if (!rel.people) return null;

  const now       = Date.now();
  const lastMs    = rel.last_contact_at ? new Date(rel.last_contact_at).getTime() : null;
  const daysSince = lastMs !== null ? Math.floor((now - lastMs) / MS_DAY) : null;
  const frequency = rel.contact_frequency_days ?? DEFAULT_FREQUENCY_DAYS;

  const overdueRatio = daysSince !== null ? daysSince / frequency : 1.2;
  const overdueScore = Math.min(100, overdueRatio * 50);

  const relScore   = compositeRelScore(rel);
  const healthNeed = 100 - relScore;

  const stageUrgency = STAGE_URGENCY[rel.stage] ?? 30;

  const priority = overdueScore * 0.4 + healthNeed * 0.3 + stageUrgency * 0.3;

  // Availability bonus: if user is in good shape → boost score (more likely to have good interactions)
  const availBonus = humanState ? (humanState.availability_score / 100) * 20 : 14;

  const contactScore = Math.round(priority * 0.8 + availBonus);

  const urgency: AdvisorSuggestion['urgency'] =
    contactScore >= 65 ? 'high' :
    contactScore >= 40 ? 'medium' : 'low';

  // Reason text
  let reason: string;
  if (rel.stage === 'dormant') {
    reason = 'Relación dormida — reactívala';
  } else if (daysSince !== null && daysSince > frequency * 1.5) {
    reason = `Sin contacto hace ${daysSince} días (meta: ${frequency})`;
  } else if (daysSince !== null && daysSince > frequency) {
    reason = `${daysSince - frequency} días pasado el objetivo de contacto`;
  } else if (relScore < 40) {
    reason = 'La relación necesita más atención';
  } else if (daysSince !== null && daysSince > frequency * 0.8) {
    reason = 'Acercándose al momento de contacto';
  } else {
    reason = 'Buen momento para mantener el contacto';
  }

  return {
    person_id:          rel.people.id,
    person_name:        rel.people.name,
    person_org:         rel.people.organization,
    urgency,
    contact_score:      contactScore,
    reason,
    last_contact_at:    rel.last_contact_at,
    days_since_contact: daysSince,
    relationship_score: relScore,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const userId  = await getUserFromRequest(req);
    const supabase = getServiceClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch today's human state + relationships+people in parallel
    const [{ data: stateData }, { data: relData, error: relError }] = await Promise.all([
      supabase
        .from('human_state_logs')
        .select('availability_score, interaction_risk, composite_score')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('relationships')
        .select('id, person_id, strength, reciprocity, trust_score, stage, last_contact_at, contact_frequency_days, people(id, name, organization, role)')
        .eq('user_id', userId)
        .limit(50),
    ]);

    if (relError) {
      console.error('[GET /api/advisor]', relError);
      return NextResponse.json({ error: relError.message }, { status: 500 });
    }

    const humanState = (stateData ?? null) as HumanStateRow | null;
    // Supabase infers joined `people` as array; at runtime it's a single object for FK many-to-one
    const rels = (relData ?? []) as unknown as RelWithPerson[];

    const suggestions = rels
      .map(r => buildSuggestion(r, humanState))
      .filter((s): s is AdvisorSuggestion => s !== null && s.contact_score > 20)
      .sort((a, b) => b.contact_score - a.contact_score)
      .slice(0, 10);

    return NextResponse.json({
      user_available:    humanState ? humanState.availability_score >= 50 : true,
      availability_score: humanState?.availability_score ?? 70,
      interaction_risk:   humanState?.interaction_risk   ?? 30,
      suggestions,
      generated_at:       new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[GET /api/advisor]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
