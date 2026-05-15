import { getServiceClient, getAuthUser } from '@/lib/supabase-server';
import { trackEvent } from '@sir/db';
import { checkRateLimit } from '@/lib/ratelimit';
import { costTracker } from '@sir/ai';
import type { DbPerson, DbRelationship } from '@sir/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_PRICE  = 3  / 1_000_000;  // $ per token — claude-sonnet-4-6
const OUTPUT_PRICE = 15 / 1_000_000;
const META_SEP     = '\n\n__META__';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StateRow {
  composite_score:    number;
  availability_score: number;
  interaction_risk:   number;
  mood_score:         number;
  energy_score:       number;
  emotional_tags:     string[];
  physical_tags:      string[];
  notes:              string | null;
  created_at:         string;
}

interface MemoryRow {
  layer:      string;
  content:    string;
  created_at: string;
}

interface SignalRow {
  type:       string;
  payload:    Record<string, unknown>;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const base = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
    const res = await fetch(`${base}/api/embeddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
      signal:  AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { embedding?: number[] };
    return json.embedding ?? null;
  } catch {
    return null;
  }
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente de inteligencia relacional de élite. Tu tarea es generar briefings ejecutivos y completamente accionables sobre personas de la red de relaciones del usuario.

SIEMPRE estructura tu respuesta con EXACTAMENTE estas 6 secciones, en este orden, con estos headers exactos:

## 1. Quién es
## 2. Estado actual
## 3. Dinámica relacional
## 4. Señales recientes
## 5. Timing & tono
## 6. Conversación sugerida

Reglas:
- Máximo 4 oraciones por sección (excepto sección 6)
- Sección 6: da exactamente 3 openers concretos y listos para usar, numerados
- Sé directo, sin relleno ni frases genéricas
- Si hay datos insuficientes en alguna sección, sé honesto y breve
- Idioma: español`;

function buildPrompt(opts: {
  person:       DbPerson;
  rel:          DbRelationship | null;
  relScore:     number | null;
  humanState:   StateRow | null;
  memories:     MemoryRow[];
  signals:      SignalRow[];
}): string {
  const { person, rel, relScore, humanState, memories, signals } = opts;

  const daysSinceLast = rel?.last_contact_at ? daysAgo(rel.last_contact_at) : 'nunca';
  const stageMap: Record<string, string> = {
    active: 'Activa', strategic: 'Estratégica', prospect: 'Prospecto', dormant: 'Dormida',
  };

  const memoriesBlock = memories.length === 0
    ? '(sin memorias asociadas)'
    : memories.slice(0, 8).map(m => `[${m.layer.toUpperCase()}] ${m.content}`).join('\n');

  const signalsBlock = signals.length === 0
    ? '(sin señales recientes que mencionen a esta persona)'
    : signals.map(s => {
        const summary = typeof s.payload['summary'] === 'string'
          ? s.payload['summary']
          : typeof s.payload['message'] === 'string'
          ? s.payload['message']
          : JSON.stringify(s.payload).slice(0, 100);
        return `- [${s.type}] ${new Date(s.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${summary}`;
      }).join('\n');

  const stateBlock = humanState
    ? `Score compuesto: ${humanState.composite_score}/100 | Disponibilidad: ${humanState.availability_score}/100 | Riesgo: ${humanState.interaction_risk}/100
Estado emocional: ${humanState.emotional_tags.length > 0 ? humanState.emotional_tags.join(', ') : 'neutro'}
Estado físico: ${humanState.physical_tags.length > 0 ? humanState.physical_tags.join(', ') : 'neutro'}
${humanState.notes ? `Notas: ${humanState.notes}` : ''}`
    : '(no hay estado registrado hoy)';

  const relTypeRaw = ((person as unknown as { relationship_type?: string }).relationship_type) ?? 'networking';
  const relTypeLabels: Record<string, string> = {
    strategic: 'Estratégico (inversor, mentor, aliado clave)',
    professional: 'Profesional (colega, cliente, proveedor)',
    networking: 'Networking (conocido, contacto de industria)',
    personal: 'Personal (amigo cercano, pareja)',
    family: 'Familia',
    developing: 'Por desarrollar (prospecto)',
  };
  const relTypeTone: Record<string, string> = {
    strategic:    'Enfócate en valor, oportunidades y alineación estratégica. Tono directo y ejecutivo.',
    professional: 'Enfócate en colaboración, objetivos profesionales y reciprocidad laboral.',
    networking:   'Enfócate en construir rapport y encontrar puntos de conexión comunes.',
    personal:     'Enfócate en la conexión emocional, el bienestar de la persona y la calidad del vínculo.',
    family:       'Tono cálido y cercano. Prioriza la conexión humana sobre lo transaccional.',
    developing:   'Enfócate en el potencial de la relación y primeros pasos para profundizar el vínculo.',
  };

  return `Genera un briefing ejecutivo sobre la siguiente persona en mi red relacional.

═══ PERSONA ═══
Nombre: ${person.name}
Tipo de relación: ${relTypeLabels[relTypeRaw] ?? relTypeRaw}
Organización: ${person.organization ?? 'No especificada'}
Rol: ${person.role ?? 'No especificado'}
Email: ${person.email ?? 'No registrado'}
Notas: ${person.notes ?? 'Sin notas'}
Conocido desde: ${new Date(person.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}

DIRECTIVA DE TONO: ${relTypeTone[relTypeRaw] ?? 'Equilibrado y profesional.'}

═══ RELACIÓN ═══
${rel ? `Etapa: ${stageMap[rel.stage] ?? rel.stage}
Score total: ${relScore ?? 'N/A'}/100
Fuerza: ${rel.strength}/100 | Reciprocidad: ${rel.reciprocity}/100 | Confianza: ${Math.round(rel.trust_score * 100)}/100
Último contacto: ${daysSinceLast}
Frecuencia objetivo: cada ${rel.contact_frequency_days ?? 30} días` : '(sin relación registrada aún)'}

═══ MI ESTADO HOY ═══
${stateBlock}

═══ MEMORIAS ASOCIADAS (${memories.length}) ═══
${memoriesBlock}

═══ SEÑALES RECIENTES ═══
${signalsBlock}

Genera el briefing ejecutivo ahora.`;
}

function buildFallbackBriefing(person: DbPerson, rel: DbRelationship | null): string {
  const stage = rel?.stage ?? 'desconocida';
  return `## 1. Quién es
${person.name}${person.organization ? `, ${person.role ?? 'contacto'} en ${person.organization}` : ''}.
${person.notes ?? 'Sin contexto adicional disponible.'}

## 2. Estado actual
No hay estado emocional registrado para esta interacción. Considera registrar tu estado del día antes de contactar.

## 3. Dinámica relacional
${rel ? `Relación en etapa ${stage}. Fuerza: ${rel.strength}/100. Último contacto: ${rel.last_contact_at ? daysAgo(rel.last_contact_at) : 'nunca registrado'}.` : 'No hay datos de relación registrados aún.'}

## 4. Señales recientes
Sin señales recientes indexadas.

## 5. Timing & tono
Activa el Claude API (ANTHROPIC_API_KEY) para obtener análisis de timing personalizado basado en tu contexto.

## 6. Conversación sugerida
1. "Hola ${person.name}, ¿cómo estás?"
2. "Quería retomar el contacto contigo. ¿Cómo va todo en ${person.organization ?? 'tu trabajo'}?"
3. "¿Tienes unos minutos esta semana para ponernos al día?"`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitRes = await checkRateLimit(authUser.id, 5, '1 m');
    if (rateLimitRes) return rateLimitRes;

    const body     = await req.json() as { personId?: string };
    const personId = body.personId;

    if (!personId) {
      return Response.json({ error: 'personId required' }, { status: 400 });
    }

    const db = getServiceClient();

    // Fetch person + relationship in parallel
    const [personRes, relRes] = await Promise.all([
      db.from('people').select('*').eq('id', personId).maybeSingle(),
      db.from('relationships').select('*').eq('person_id', personId).maybeSingle(),
    ]);

    if (!personRes.data) {
      return Response.json({ error: 'Person not found' }, { status: 404 });
    }

    const person   = personRes.data  as DbPerson;
    const rel      = relRes.data     as DbRelationship | null;
    const userId   = person.user_id;
    const relScore = rel
      ? Math.round(rel.strength * 0.4 + rel.reciprocity * 0.3 + rel.trust_score * 100 * 0.3)
      : null;

    // Fetch state + signals + embedding in parallel
    const [stateRes, signalsRes, embedding] = await Promise.all([
      db.from('human_state_logs')
        .select('composite_score, availability_score, interaction_risk, mood_score, energy_score, emotional_tags, physical_tags, notes, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from('signals')
        .select('type, payload, created_at')
        .eq('user_id', userId)
        .in('type', ['interaction', 'relationship', 'emotion'])
        .order('created_at', { ascending: false })
        .limit(25),
      getEmbedding(person.name),
    ]);

    // Filter signals mentioning this person
    const nameLower   = person.name.toLowerCase();
    const personSignals = ((signalsRes.data ?? []) as SignalRow[])
      .filter(s => JSON.stringify(s.payload).toLowerCase().includes(nameLower))
      .slice(0, 5);

    // Semantic memory search with text fallback
    let memories: MemoryRow[] = [];
    if (embedding) {
      const { data } = await db.rpc('search_memories', {
        p_user_id:   userId,
        p_query:     embedding,
        p_limit:     10,
        p_threshold: 0.35,
      });
      memories = (data ?? []) as MemoryRow[];
    }
    if (memories.length === 0) {
      const { data } = await db.from('memories')
        .select('layer, content, created_at')
        .eq('user_id', userId)
        .ilike('content', `%${person.name}%`)
        .not('layer', 'in', '("sensory","working")')
        .is('expires_at', null)
        .order('importance', { ascending: false })
        .limit(10);
      memories = (data ?? []) as MemoryRow[];
    }

    const humanState = stateRes.data as StateRow | null;
    const prompt     = buildPrompt({ person, rel, relScore, humanState, memories, signals: personSignals });

    // Cost limit check — force static fallback if over $5/month
    const overLimit = await costTracker.isOverMonthlyLimit(userId).catch(() => false);

    // No Claude key — static fallback
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey || overLimit) {
      const fallback = buildFallbackBriefing(person, rel);
      return new Response(
        fallback + META_SEP + JSON.stringify({ inputTokens: 0, outputTokens: 0, costUsd: 0, briefingId: null }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    // Streaming from Claude
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const claude  = new Anthropic({ apiKey });
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText     = '';
        let inputTokens  = 0;
        let outputTokens = 0;

        try {
          const stream = claude.messages.stream({
            model:      'claude-sonnet-4-6',
            max_tokens: 1400,
            system:     SYSTEM_PROMPT,
            messages:   [{ role: 'user', content: prompt }],
          });

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullText += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            } else if (event.type === 'message_start') {
              inputTokens = event.message.usage.input_tokens;
            } else if (event.type === 'message_delta') {
              outputTokens = event.usage.output_tokens;
            }
          }

          const costUsd = inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE;

          // Persist briefing
          let briefingId: string | null = null;
          try {
            const { data } = await db.from('briefings').insert({
              user_id:       userId,
              person_id:     personId,
              content:       fullText,
              input_tokens:  inputTokens,
              output_tokens: outputTokens,
              cost_usd:      costUsd,
            }).select('id').single();
            briefingId = (data as { id: string } | null)?.id ?? null;
          } catch {
            // non-critical
          }

          costTracker.track(userId, 'claude-sonnet-4-6', inputTokens, outputTokens).catch(() => undefined);
          trackEvent(userId, 'briefing_viewed', {
            personId,
            briefingId,
            inputTokens,
            outputTokens,
            costUsd,
          }).catch(() => undefined);

          controller.enqueue(encoder.encode(
            META_SEP + JSON.stringify({ inputTokens, outputTokens, costUsd, briefingId })
          ));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Streaming error';
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type':        'text/plain; charset=utf-8',
        'Cache-Control':       'no-cache, no-store',
        'X-Accel-Buffering':   'no',
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/briefing]', err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
