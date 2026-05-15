import { type NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import { getSubscriptionStatus } from '@/lib/subscription';
import { costTracker } from '@sir/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_PRICE  = 3  / 1_000_000;
const OUTPUT_PRICE = 15 / 1_000_000;

function buildFallback(): string {
  return `## Resumen ejecutivo
• Esta semana has mantenido actividad en tu red de relaciones.
• Revisa las señales capturadas para identificar oportunidades de alto impacto.
• Tu capital social se mantiene estable — continúa cultivando relaciones estratégicas.

## Acciones prioritarias esta semana
1. Contacta a tu relación estratégica más importante — mantén el momentum.
2. Atiende las oportunidades sin procesar antes de que pierdan relevancia.
3. Registra interacciones de esta semana para mantener el contexto actualizado.

## Retrospectiva
El seguimiento consistente de señales y briefings es la clave para maximizar el valor de tu red. Mantén la cadencia.`;
}

function buildPrompt(data: {
  interactions: number;
  newSignals: number;
  briefings: number;
  staleCount: number;
  topRels: Array<{ name: string; org: string | null; score: number; stage: string; daysSince: number | null }>;
  topOpps: Array<{ signal_type: string | null; opportunity_score: number; action_recommendation: string | null }>;
}): string {
  const relsBlock = data.topRels.length === 0
    ? '(sin relaciones activas)'
    : data.topRels.map((r, i) => `${i + 1}. ${r.name}${r.org ? ` (${r.org})` : ''} — Score: ${r.score} | Etapa: ${r.stage} | Días sin contacto: ${r.daysSince ?? 'desconocido'}`).join('\n');

  const oppsBlock = data.topOpps.length === 0
    ? '(sin oportunidades identificadas)'
    : data.topOpps.map(o => `- [${o.signal_type}, score ${o.opportunity_score}] ${o.action_recommendation ?? ''}`).join('\n');

  return `Eres un asesor ejecutivo de alto nivel. Genera un reporte ejecutivo semanal para el usuario.

FORMATO OBLIGATORIO:

## Resumen ejecutivo
• [bullet sobre el estado general de la red esta semana]
• [bullet sobre señales y oportunidades]
• [bullet sobre tendencia general]

## Acciones prioritarias esta semana
1. [acción concreta — persona específica + canal + motivo]
2. [acción concreta — oportunidad o relación a cultivar]
3. [acción concreta — relación en riesgo o dormida]

## Retrospectiva
[2-3 líneas de análisis sobre patrones observados]

Reglas: máximo 2 líneas por punto. Sin relleno. En español.

═══ DATOS DE LA SEMANA ═══

ACTIVIDAD:
- Interacciones registradas: ${data.interactions}
- Señales nuevas capturadas: ${data.newSignals}
- Briefings generados: ${data.briefings}
- Relaciones sin contacto >30 días: ${data.staleCount}

TOP RELACIONES:
${relsBlock}

TOP OPORTUNIDADES SIN ATENDER:
${oppsBlock}

Genera el reporte ejecutivo ahora.`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  void req;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await getSubscriptionStatus();
  if (sub === 'free') return NextResponse.json({ error: 'Pro required' }, { status: 403 });

  const db = getServiceClient();
  const weekAgo   = new Date(Date.now() - 7  * 86_400_000).toISOString();
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [interactionsRes, signalsRes, briefingsRes, staleRes, noContactRes, relsRes, oppsRes] = await Promise.all([
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'interaction').gte('created_at', weekAgo),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
    db.from('briefings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
    db.from('relationships').select('person_id', { count: 'exact', head: true }).eq('user_id', user.id).lt('last_contact_at', thirtyAgo),
    db.from('relationships').select('person_id', { count: 'exact', head: true }).eq('user_id', user.id).is('last_contact_at', null),
    db.from('relationships').select('person_id, strength, reciprocity, trust_score, stage, last_contact_at').eq('user_id', user.id).order('strength', { ascending: false }).limit(5),
    db.from('signals').select('signal_type, opportunity_score, action_recommendation').eq('user_id', user.id).not('signal_type', 'is', null).eq('processed', false).order('opportunity_score', { ascending: false }).limit(3),
  ]);

  type RelRow = { person_id: string; strength: number; reciprocity: number; trust_score: number; stage: string; last_contact_at: string | null };
  const rels = (relsRes.data ?? []) as RelRow[];
  const personIds = rels.map(r => r.person_id);
  let peopleMap = new Map<string, { id: string; name: string; organization: string | null }>();
  if (personIds.length > 0) {
    const { data } = await db.from('people').select('id, name, organization').in('id', personIds);
    peopleMap = new Map(((data ?? []) as Array<{ id: string; name: string; organization: string | null }>).map(p => [p.id, p]));
  }

  const now = Date.now();
  const topRels = rels.map(r => {
    const p = peopleMap.get(r.person_id);
    const score = Math.round(r.strength * 0.4 + r.reciprocity * 0.3 + r.trust_score * 100 * 0.3);
    const lastMs = r.last_contact_at ? new Date(r.last_contact_at).getTime() : null;
    const daysSince = lastMs !== null ? Math.floor((now - lastMs) / 86_400_000) : null;
    return { name: p?.name ?? 'Desconocido', org: p?.organization ?? null, score, stage: r.stage, daysSince };
  });

  type OppRow = { signal_type: string | null; opportunity_score: number; action_recommendation: string | null };
  const topOpps = (oppsRes.data ?? []) as OppRow[];

  const contextData = {
    interactions: interactionsRes.count ?? 0,
    newSignals:   signalsRes.count      ?? 0,
    briefings:    briefingsRes.count    ?? 0,
    staleCount:   (staleRes.count ?? 0) + (noContactRes.count ?? 0),
    topRels,
    topOpps,
  };

  const overLimit = await costTracker.isOverMonthlyLimit(user.id).catch(() => false);
  const apiKey    = process.env['ANTHROPIC_API_KEY'];

  if (!apiKey || overLimit) {
    return NextResponse.json({ content: buildFallback(), tokens: 0, costUsd: 0 });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey });
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: buildPrompt(contextData) }],
    });
    const content = (message.content[0] as { text?: string })?.text ?? buildFallback();
    const inputTokens  = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE;
    costTracker.track(user.id, 'claude-sonnet-4-6', inputTokens, outputTokens).catch(() => undefined);
    return NextResponse.json({ content, tokens: inputTokens + outputTokens, costUsd });
  } catch {
    return NextResponse.json({ content: buildFallback(), tokens: 0, costUsd: 0 });
  }
}
