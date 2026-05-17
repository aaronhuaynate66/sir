import { type NextRequest } from 'next/server';
import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';
import { getValidToken, type GoogleIntegration } from '../_lib';

export const dynamic = 'force-dynamic';

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; self?: boolean }>;
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const specificId = req.nextUrl.searchParams.get('id');

  let integrations: GoogleIntegration[];
  if (specificId) {
    const { data: row } = await db
      .from('google_integrations')
      .select('*')
      .eq('id', specificId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!row) return Response.json({ error: 'Integration not found' }, { status: 404 });
    integrations = [row as GoogleIntegration];
  } else {
    const { data: rows } = await db
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id);
    if (!rows || (rows as unknown[]).length === 0) {
      return Response.json({ error: 'Not connected to Google' }, { status: 400 });
    }
    integrations = rows as GoogleIntegration[];
  }

  // Pre-load people for email matching (shared across accounts)
  const { data: people } = await db
    .from('people')
    .select('id, email')
    .eq('user_id', user.id);

  const emailToPersonId = new Map<string, string>();
  for (const p of (people ?? []) as Array<{ id: string; email: string | null }>) {
    if (p.email) emailToPersonId.set(p.email.toLowerCase(), p.id);
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let totalMeetings = 0, totalInteractions = 0;

  for (const integration of integrations) {
    let token: string;
    try {
      token = await getValidToken(integration, user.id);
    } catch {
      continue;
    }

    const params = new URLSearchParams({
      timeMin:      sixMonthsAgo.toISOString(),
      maxResults:   '500',
      singleEvents: 'true',
      orderBy:      'startTime',
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as { items?: CalendarEvent[] };
    if (!res.ok) continue;

    let meetingsProcessed = 0, interactionsCreated = 0;

    for (const event of (data.items ?? [])) {
      const attendees = (event.attendees ?? []).filter(a => !a.self);
      if (attendees.length < 1) continue;

      const startIso = event.start?.dateTime ?? event.start?.date;
      if (!startIso) continue;

      meetingsProcessed++;

      for (const attendee of attendees) {
        const personId = emailToPersonId.get(attendee.email.toLowerCase());
        if (!personId) continue;

        await db.from('signals').insert({
          user_id:   user.id,
          person_id: personId,
          type:      'interaction',
          payload:   {
            source:      'google_calendar',
            event_title: event.summary ?? 'Reunión',
            event_date:  startIso,
          },
          created_at: new Date(startIso).toISOString(),
        });
        interactionsCreated++;

        const { data: rel } = await db
          .from('relationships')
          .select('id, strength')
          .eq('user_id', user.id)
          .eq('person_id', personId)
          .single();

        if (rel) {
          const r = rel as { id: string; strength: number };
          await db.from('relationships').update({
            strength:        Math.min(100, (r.strength ?? 0) + 5),
            last_contact_at: new Date(startIso).toISOString(),
          }).eq('id', r.id);
        }
      }
    }

    await db.from('google_integrations').update({
      events_synced: meetingsProcessed,
      last_sync_at:  new Date().toISOString(),
    }).eq('id', integration.id);

    totalMeetings     += meetingsProcessed;
    totalInteractions += interactionsCreated;
  }

  return Response.json({ meetings_processed: totalMeetings, interactions_created: totalInteractions });
}
