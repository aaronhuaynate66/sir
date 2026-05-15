import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import type { WorkHistoryEntry, CycleData } from '@sir/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { WorkHistoryEntry };

interface AnalyzeBody {
  image:    string; // base64
  mimeType: string; // e.g. "image/jpeg"
}

export interface AnalysisResult {
  type:     'linkedin' | 'instagram' | 'whatsapp' | 'unknown';
  data: {
    name?:                    string | null;
    role?:                    string | null;
    organization?:            string | null;
    email?:                   string | null;
    phone?:                   string | null;
    linkedin_url?:            string | null;
    instagram_url?:           string | null;
    birthday?:                string | null; // YYYY-MM-DD
    anniversary?:             string | null; // YYYY-MM-DD
    location?:                string | null;
    education?:               string | null;
    connections?:             number | null;
    work_history?:            WorkHistoryEntry[] | null;
    notes?:                   string | null;
    raw_summary?:             string | null;
    // WhatsApp-specific
    conversation_tone?:       string | null;
    emotional_state?:         string | null;
    topics?:                  string[] | null;
    last_interaction_quality?: string | null;
    cycle_data?:              CycleData | null;
  };
}

const SYSTEM = `You are an expert at extracting structured contact information from screenshots.
Analyze the screenshot and return ONLY a valid JSON object — no markdown, no extra text.

Detect the platform: "linkedin", "instagram", "whatsapp", or "unknown".

Required JSON structure:
{
  "type": "linkedin" | "instagram" | "whatsapp" | "unknown",
  "data": {
    "name": string or null,
    "role": string or null,
    "organization": string or null,
    "email": string or null,
    "phone": string or null,
    "linkedin_url": string or null,
    "instagram_url": string or null,
    "birthday": "YYYY-MM-DD" or null,
    "anniversary": "YYYY-MM-DD" or null,
    "location": string or null,
    "education": string or null,
    "connections": number or null,
    "work_history": [
      { "role": "...", "company": "...", "period": "..." }
    ] or null,
    "notes": "brief qualitative summary only — do NOT include location, education, work history, connections, or cycle/menstrual info here",
    "raw_summary": "one sentence describing what you see"
  }
}

If the platform is "whatsapp", also include these additional fields inside "data":
{
  "conversation_tone": "warm" | "neutral" | "tense" | "distant" | null,
  "emotional_state": brief description of detected emotional state or null,
  "topics": ["topic1", "topic2"] or null,
  "last_interaction_quality": "positive" | "neutral" | "negative" | null,
  "cycle_data": {
    "detected": true | false,
    "last_period_start": "YYYY-MM-DD" or null,
    "notes": string or null
  } or null
}

Rules:
- location: city/region/country visible on the profile (e.g. "Área metropolitana de Lima")
- education: most recent or most prominent institution (e.g. "Universidad Marcelino Champagnat")
- connections: numeric count if visible (e.g. 55), otherwise null
- work_history: extract ALL job entries visible, each with role, company, and period (e.g. "oct. 2025 - present")
- notes: ONLY qualitative observations not captured by other fields. Never put location/education/work/connections/cycle info in notes.
- birthday/anniversary: only if explicitly shown. Format YYYY-MM-DD; use 2000 as year if only month/day visible.
- linkedin_url: build from username if visible (https://linkedin.com/in/username)
- instagram_url: build from handle if visible (https://instagram.com/handle)
- cycle_data: set detected=true only if the conversation explicitly mentions menstrual cycle, period, or menstruation. Extract last_period_start date if mentioned. Do NOT infer or assume cycle info.
- Return ONLY the JSON object.
- IMPORTANT: Always respond in Spanish. All text fields including notes, summaries, descriptions, role titles, period labels, emotional_state, and topics must be in Spanish.`;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getServiceClient();
    const { data: person } = await db
      .from('people')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!person) return Response.json({ error: 'Not found' }, { status: 404 });

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return Response.json({ error: 'AI not configured' }, { status: 503 });

    const body = await req.json() as AnalyzeBody;
    if (!body.image || !body.mimeType) {
      return Response.json({ error: 'image and mimeType required' }, { status: 400 });
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey });

    const msg = await claude.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1500,
      system:     SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: body.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: body.image },
          },
          { type: 'text', text: 'Extract all contact information from this screenshot.' },
        ],
      }],
    });

    const raw   = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';
    const clean = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

    let result: AnalysisResult;
    try {
      result = JSON.parse(clean) as AnalysisResult;
    } catch {
      result = { type: 'unknown', data: { raw_summary: raw.slice(0, 200) } };
    }

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
