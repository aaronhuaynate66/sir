import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalyzeBody {
  image:    string; // base64
  mimeType: string; // e.g. "image/jpeg"
}

export interface AnalysisResult {
  type:     'linkedin' | 'instagram' | 'whatsapp' | 'unknown';
  data: {
    name?:          string;
    role?:          string;
    organization?:  string;
    email?:         string;
    phone?:         string;
    linkedin_url?:  string;
    instagram_url?: string;
    birthday?:      string; // ISO date YYYY-MM-DD
    anniversary?:   string; // ISO date YYYY-MM-DD
    notes?:         string;
    raw_summary?:   string;
  };
}

const SYSTEM = `You are an expert at extracting contact information from screenshots.
Analyze the provided screenshot and extract as much structured data as possible.

Detect the platform type: "linkedin" (LinkedIn profile), "instagram" (Instagram profile/DM),
"whatsapp" (WhatsApp chat or contact), or "unknown".

Return ONLY a valid JSON object with this exact structure:
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
    "notes": string or null,
    "raw_summary": "one sentence describing what you see"
  }
}

Rules:
- For birthday/anniversary: only include if explicitly visible in the screenshot. Format as YYYY-MM-DD. If only month/day visible use 2000 as the year.
- For linkedin_url: construct from the username if visible (https://linkedin.com/in/username)
- For instagram_url: construct from the handle if visible (https://instagram.com/handle)
- Return ONLY the JSON object, no markdown, no extra text.`;

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
      max_tokens: 1024,
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

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';

    let result: AnalysisResult;
    try {
      result = JSON.parse(raw) as AnalysisResult;
    } catch {
      result = { type: 'unknown', data: { raw_summary: raw.slice(0, 200) } };
    }

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
