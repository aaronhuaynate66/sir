import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import { getSubscriptionStatus } from '@/lib/subscription';
import { costTracker } from '@sir/ai';
import { trackEvent } from '@sir/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_PRICE  = 3  / 1_000_000;
const OUTPUT_PRICE = 15 / 1_000_000;

interface RelRow { id: string; person_id: string; strength: number; reciprocity: number; trust_score: number; last_contact_at: string | null; stage: string }
interface PersonRow { id: string; name: string; organization: string | null }
interface StateRow { mood_score: number; energy_score: number; created_at: string }
interface SignalRow { signal_type: string | null; opportunity_score: number | null; action_recommendation: string | null }

function buildPrompt(data: {
  topRelations: Array<{ name: string; org: string | null; score: number; lastContact: string | null; stage: string }>;
  signalCounts: Record<string, number>;
  stateTrend: Array<{ mood: number; energy: number; date: string }>;
  topOpps: SignalRow[];
}): string {
  const relsBlock = data.topRelations.length === 0
    ? '(sin relaciones activas esta semana)'
    : data.topRelations.map((r, i) => `${i + 1}. ${r.name}${r.org ? ` (${r.org})` : ''} — Score: ${r.score} | Etapa: ${r.stage} | Último contacto: ${r.lastContact ?? 'nunca'}`).join('\n');

  const signalsBlock = Object.entries(data.signalCounts).length === 0
    ? '(sin señales capturadas esta semana)'
    : Object.entries(data.signalCounts).map(([type, count]) => `- ${type}: ${count}`).join('\n');

  const stateBlock = data.stateTrend.length === 0
    ? '(sin registros de estado esta semana)'
    : data.stateTrend.map(s => `${s.date}: Mood ${s.mood}/5 | Energía ${s.energy}/10`).join('\n');

  const oppsBlock = data.topOpps.length === 0
    ? '(sin oportunidades identificadas)'
    : data.topOpps.map(o => `- [${o.signal_type ?? 'unknown'}, score ${o.opportunity_score}] ${o.action_recommendation ?? ''}`).join('\n');

  return `Eres un asesor ejecutivo de alto nivel. Genera un briefing ejecutivo semanal MUY conciso para el usuario.

FORMATO OBLIGATORIO — dos bloques exactos:

## Contexto semana
• [bullet 1 sobre el estado de relaciones]
• [bullet 2 sobre señales y oportunidades]
• [bullet 3 sobre el estado personal/energía]

## Acciones prioritarias
1. [acción concreta y accionable — persona + canal + motivo]
2. [acción concreta y accionable]
3. [acción concreta y accionable]

Reglas: máximo 2 líneas por bullet/acción. Sin relleno. Idioma español.

═══ DATOS ═══

TOP RELACIONES (por score):
${relsBlock}

SEÑALES ESTA SEMANA (por tipo):
${signalsBlock}

TENDENCIA DE ESTADO (últimos 7 días):
${stateBlock}

OPORTUNIDADES IDENTIFICADAS:
${oppsBlock}

Genera el briefing ejecutivo ahora.`;
}

function buildFallback(): string {
  return `## Contexto semana
• Revisa tu red de relaciones para identificar contactos que necesitan atención.
• Captura señales de tus interacciones para obtener análisis personalizados.
• Registra tu estado diario para que SIR pueda adaptar las recomendaciones.

## Acciones prioritarias
1. Contacta a tu relación más estratégica — retoma el hilo de vuestra última conversación.
2. Captura una señal de interacción reciente para alimentar el motor de contexto.
3. Registra tu estado de hoy para calibrar el timing de tus próximos contactos.`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await getSubscriptionStatus();
  if (sub === 'free') return NextResponse.json({ error: 'Pro required' }, { status: 403 });

  const db = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [relsRes, stateRes, signalsRes, oppsRes] = await Promise.all([
    db.from('relationships').select('id, person_id, strength, reciprocity, trust_score, last_contact_at, stage').eq('user_id', user.id).order('strength', { ascending: false }).limit(5),
    db.from('human_state_logs').select('mood_score, energy_score, created_at').eq('user_id', user.id).gte('created_at', weekAgo).order('created_at', { ascending: true }).limit(7),
    db.from('signals').select('signal_type').eq('user_id', user.id).gte('created_at', weekAgo).not('signal_type', 'is', null).limit(100),
    db.from('signals').select('signal_type, opportunity_score, action_recommendation').eq('user_id', user.id).not('signal_type', 'is', null).order('opportunity_score', { ascending: false }).limit(3),
  ]);

  const rels = (relsRes.data ?? []) as RelRow[];
  const personIds = rels.map(r => r.person_id);
  let peopleMap = new Map<string, PersonRow>();
  if (personIds.length > 0) {
    const { data } = await db.from('people').select('id, name, organization').in('id', personIds);
    peopleMap = new Map(((data ?? []) as PersonRow[]).map(p => [p.id, p]));
  }

  const topRelations = rels.map(r => {
    const p = peopleMap.get(r.person_id);
    const score = Math.round(r.strength * 0.4 + r.reciprocity * 0.3 + r.trust_score * 100 * 0.3);
    return { name: p?.name ?? 'Desconocido', org: p?.organization ?? null, score, lastContact: r.last_contact_at, stage: r.stage };
  });

  const signalCounts: Record<string, number> = {};
  for (const s of (signalsRes.data ?? []) as Array<{ signal_type: string | null }>) {
    if (s.signal_type) signalCounts[s.signal_type] = (signalCounts[s.signal_type] ?? 0) + 1;
  }

  const stateTrend = ((stateRes.data ?? []) as StateRow[]).map(s => ({
    mood: s.mood_score,
    energy: s.energy_score,
    date: new Date(s.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
  }));

  const topOpps = (oppsRes.data ?? []) as SignalRow[];

  const overLimit = await costTracker.isOverMonthlyLimit(user.id).catch(() => false);
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (!apiKey || overLimit) {
    const fallback = buildFallback();
    return NextResponse.json({ content: fallback, tokens: 0, costUsd: 0 });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey });
    const prompt = buildPrompt({ topRelations, signalCounts, stateTrend, topOpps });

    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = (message.content[0] as { text?: string })?.text ?? buildFallback();
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE;

    costTracker.track(user.id, 'claude-sonnet-4-6', inputTokens, outputTokens).catch(() => undefined);
    trackEvent(user.id, 'briefing_viewed', { type: 'executive', inputTokens, outputTokens, costUsd }).catch(() => undefined);

    return NextResponse.json({ content, tokens: inputTokens + outputTokens, costUsd });
  } catch {
    return NextResponse.json({ content: buildFallback(), tokens: 0, costUsd: 0 });
  }
}
