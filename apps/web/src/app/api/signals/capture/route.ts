import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import { trackServerEvent, EVENTS } from '@sir/analytics';
import { checkRateLimit } from '@/lib/ratelimit';
import { captureSignalSchema } from '@/lib/schemas';
import { costTracker } from '@sir/ai';
import type { SocialSignalType } from '@sir/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_TYPES: SocialSignalType[] = [
  'promotion', 'job_change', 'travel', 'birthday', 'publication',
  'life_event', 'health_event', 'achievement', 'loss',
];

const DEFAULT_SCORES: Record<SocialSignalType, number> = {
  job_change:   90,
  promotion:    85,
  achievement:  80,
  publication:  75,
  birthday:     70,
  life_event:   70,
  loss:         65,
  travel:       60,
  health_event: 55,
};

const DEFAULT_ACTIONS: Record<SocialSignalType, string> = {
  job_change:   'Felicita personalmente y muestra curiosidad por el nuevo rol.',
  promotion:    'Envía un mensaje de felicitación y ofrece tu apoyo.',
  achievement:  'Reconoce el logro con entusiasmo genuino.',
  publication:  'Lee el contenido, comenta algo específico y compártelo si es relevante.',
  birthday:     'Envía un mensaje cálido y personalizado, evita el genérico.',
  life_event:   'Envía un mensaje de apoyo o felicitación según el contexto.',
  loss:         'Ofrece apoyo con empatía sin forzar la conversación.',
  travel:       'Pregunta sobre el destino y propón un café al regresar.',
  health_event: 'Envía un mensaje de apoyo y ofrece ayuda concreta.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()); } catch { /* */ }
  const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (m?.[1]) { try { return JSON.parse(m[1]); } catch { /* */ } }
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch { /* */ } }
  return null;
}

function ruleBasedExtract(content: string): {
  signal_type: SocialSignalType;
  person_name: string | null;
  opportunity_score: number;
  action_recommendation: string;
} {
  const lower = content.toLowerCase();
  let signal_type: SocialSignalType = 'life_event';

  if (/promoci|ascenso|ascendid|new title|promot|raised/.test(lower))           signal_type = 'promotion';
  else if (/nuevo trabajo|nueva empresa|se une a|new job|joined|starting at/.test(lower)) signal_type = 'job_change';
  else if (/viaj|travel|trip|vacac|visitando|visiting/.test(lower))              signal_type = 'travel';
  else if (/cumplea|birthday|aniversar/.test(lower))                              signal_type = 'birthday';
  else if (/publicó|escribió|artículo|libro|published|wrote|authored/.test(lower)) signal_type = 'publication';
  else if (/boda|matrimon|bebé|nacimiento|graduac|wedding|baby|born|graduated/.test(lower)) signal_type = 'life_event';
  else if (/enferm|cirugía|hospital|sick|surgery|health issue|cancer/.test(lower)) signal_type = 'health_event';
  else if (/ganó|premio|award|won|achieved|accomplish/.test(lower))              signal_type = 'achievement';
  else if (/falleció|murió|died|passed away|divorc|pérdida de/.test(lower))      signal_type = 'loss';

  const nameMatch = content.match(/\b([A-ZÁÉÍÓÚ][a-záéíóúñü]+ [A-ZÁÉÍÓÚ][a-záéíóúñü]+)\b/);

  return {
    signal_type,
    person_name: nameMatch?.[1] ?? null,
    opportunity_score: DEFAULT_SCORES[signal_type] ?? 60,
    action_recommendation: DEFAULT_ACTIONS[signal_type] ?? 'Considera contactar a esta persona.',
  };
}

const EXTRACTION_PROMPT = (content: string) =>
  `Analyze this text and extract a social signal.

Text: "${content}"

Return ONLY valid JSON (no markdown, no extra text):
{
  "signal_type": "one of: promotion|job_change|travel|birthday|publication|life_event|health_event|achievement|loss",
  "person_name": "full name of main person mentioned, or null",
  "opportunity_score": <integer 0-100>,
  "action_recommendation": "<specific 1-sentence action to strengthen this relationship>"
}

Score guide: job_change/promotion=85-95, achievement=80-90, birthday/life_event=65-80, travel=55-70, loss=60-75, health=50-65`;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitRes = await checkRateLimit(user.id, 10, '1 m');
    if (rateLimitRes) return rateLimitRes;

    const raw   = await req.json().catch(() => ({})) as unknown;
    const parse = captureSignalSchema.safeParse(raw);
    if (!parse.success) {
      return Response.json({ error: parse.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
    }
    const { content, person_id: bodyPersonId } = parse.data;

    const db = getServiceClient();
    let personId: string | null = bodyPersonId ?? null;

    // ── AI extraction ─────────────────────────────────────────────────────────
    let extracted: ReturnType<typeof ruleBasedExtract> | null = null;

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const claude = new Anthropic({ apiKey });
        const msg = await claude.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages:   [{ role: 'user', content: EXTRACTION_PROMPT(content) }],
        });
        const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
        costTracker.track(user.id, 'claude-haiku-4-5-20251001', msg.usage.input_tokens, msg.usage.output_tokens).catch(() => undefined);
        const json = extractJson(text);
        if (json && SOCIAL_TYPES.includes(json['signal_type'] as SocialSignalType)) {
          const st = json['signal_type'] as SocialSignalType;
          extracted = {
            signal_type:          st,
            person_name:          typeof json['person_name'] === 'string' ? json['person_name'] : null,
            opportunity_score:    typeof json['opportunity_score'] === 'number'
              ? Math.min(100, Math.max(0, Math.round(json['opportunity_score'])))
              : DEFAULT_SCORES[st] ?? 60,
            action_recommendation: typeof json['action_recommendation'] === 'string'
              ? json['action_recommendation']
              : DEFAULT_ACTIONS[st] ?? '',
          };
        }
      } catch { /* fall through to Ollama */ }
    }

    // Ollama fallback (local dev)
    if (!extracted) {
      try {
        const base = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
        const res = await fetch(`${base}/api/generate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            model:   'llama3.2',
            prompt:  EXTRACTION_PROMPT(content),
            stream:  false,
            options: { temperature: 0.1, num_predict: 300 },
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json() as { response: string };
          const json = extractJson(data.response);
          if (json && SOCIAL_TYPES.includes(json['signal_type'] as SocialSignalType)) {
            const st = json['signal_type'] as SocialSignalType;
            extracted = {
              signal_type:          st,
              person_name:          typeof json['person_name'] === 'string' ? json['person_name'] : null,
              opportunity_score:    typeof json['opportunity_score'] === 'number'
                ? Math.min(100, Math.max(0, Math.round(json['opportunity_score'])))
                : DEFAULT_SCORES[st] ?? 60,
              action_recommendation: typeof json['action_recommendation'] === 'string'
                ? json['action_recommendation']
                : DEFAULT_ACTIONS[st] ?? '',
            };
          }
        }
      } catch { /* fall through to rule-based */ }
    }

    if (!extracted) extracted = ruleBasedExtract(content);

    // ── Resolve person from name if not supplied ───────────────────────────────
    if (!personId && extracted.person_name) {
      const { data: matched } = await db.from('people')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', `%${extracted.person_name}%`)
        .limit(1);
      if (matched?.[0]) personId = (matched[0] as { id: string }).id;
    }

    // ── Create signal ──────────────────────────────────────────────────────────
    const insertData = {
      user_id:              user.id,
      type:                 'external' as const,
      payload:              { summary: content, extracted_person: extracted.person_name },
      processed:            true,
      signal_type:          extracted.signal_type,
      opportunity_score:    extracted.opportunity_score,
      action_recommendation: extracted.action_recommendation,
      processed_at:         new Date().toISOString(),
      source:               'manual',
      ...(personId ? { person_id: personId } : {}),
    };

    const { data: signal, error: signalError } = await db
      .from('signals')
      .insert(insertData)
      .select('id')
      .single();

    if (signalError) throw signalError;
    const signalId = (signal as { id: string }).id;

    // ── Create social memory ───────────────────────────────────────────────────
    const label = extracted.signal_type.toUpperCase().replace('_', ' ');
    const who   = extracted.person_name ?? 'contacto';
    await db.from('memories').insert({
      user_id:    user.id,
      layer:      'social',
      content:    `[${label}] ${who}: ${content.slice(0, 200)}`,
      importance: Math.min(10, Math.round(extracted.opportunity_score / 10)),
      metadata:   { signal_id: signalId, signal_type: extracted.signal_type, person_id: personId },
    });

    trackServerEvent(user.id, EVENTS.SIGNAL_CREATED, {
      signal_type:       extracted.signal_type,
      source:            'capture_api',
      opportunity_score: extracted.opportunity_score,
      ...(personId ? { person_id: personId } : {}),
    });

    return Response.json({
      signalId,
      signalType:           extracted.signal_type,
      opportunityScore:     extracted.opportunity_score,
      actionRecommendation: extracted.action_recommendation,
      personId,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/signals/capture]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
