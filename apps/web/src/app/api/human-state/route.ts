import { NextResponse } from 'next/server';
import { getUserFromRequest, AuthError } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase-server';
import { trackEvent } from '@sir/db';
import { checkRateLimit } from '@/lib/ratelimit';
import { humanStateSchema } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HumanStateBody {
  mood_score: number;       // 1-5
  energy_score: number;     // 1-10
  physical_tags: string[];
  emotional_tags: string[];
  notes?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function calculateScores(b: HumanStateBody) {
  const moodNorm   = (b.mood_score - 1) / 4;    // 0–1
  const energyNorm = (b.energy_score - 1) / 9;  // 0–1

  const negPhys = ['cansado', 'enfermo'].filter(t => b.physical_tags.includes(t)).length;
  const posPhys = ['descansado', 'activo'].filter(t => b.physical_tags.includes(t)).length;
  const physFactor = clamp((posPhys - negPhys + 2) / 4, 0, 1);

  const negEmot = ['ansioso', 'estresado'].filter(t => b.emotional_tags.includes(t)).length;
  const posEmot = ['tranquilo', 'motivado', 'feliz'].filter(t => b.emotional_tags.includes(t)).length;
  const emotFactor = clamp((posEmot - negEmot + 2) / 5, 0, 1);

  const composite_score    = Math.round(moodNorm * 40 + energyNorm * 30 + physFactor * 15 + emotFactor * 15);
  const availability_score = Math.round(moodNorm * 50 + energyNorm * 20 + emotFactor * 30);
  const interaction_risk   = 100 - availability_score;

  return { composite_score, availability_score, interaction_risk };
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const userId = await getUserFromRequest(req);

    const rateLimitRes = await checkRateLimit(userId, 30, '1 m');
    if (rateLimitRes) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const raw   = await req.json().catch(() => ({})) as unknown;
    const parse = humanStateSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
    }
    const p = parse.data;
    const body: HumanStateBody = {
      mood_score:     p.mood_score,
      energy_score:   p.energy_score,
      physical_tags:  p.physical_tags,
      emotional_tags: p.emotional_tags,
      ...(p.notes != null ? { notes: p.notes } : {}),
    };

    const scores = calculateScores(body);

    const { data, error } = await getServiceClient()
      .from('human_state_logs')
      .insert({
        user_id:        userId,
        mood_score:     body.mood_score,
        energy_score:   body.energy_score,
        physical_tags:  body.physical_tags  ?? [],
        emotional_tags: body.emotional_tags ?? [],
        notes:          body.notes          ?? null,
        ...scores,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/human-state]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackEvent(userId, 'state_updated', {
      compositeScore:    scores.composite_score,
      availabilityScore: scores.availability_score,
      interactionRisk:   scores.interaction_risk,
    }).catch(() => undefined);

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[POST /api/human-state]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
