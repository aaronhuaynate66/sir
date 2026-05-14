import { type NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import * as React from 'react';
import { getServiceClient } from '@/lib/supabase-server';
import { WeeklyDigest } from '@/emails/WeeklyDigest';
import { ReconnectReminder } from '@/emails/ReconnectReminder';
import { BirthdayAlert } from '@/emails/BirthdayAlert';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WEB_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sir-web.vercel.app';
const EMAIL_FROM = process.env['EMAIL_FROM'] ?? 'SIR <notifications@sir-app.com>';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string;
  push_enabled: boolean;
  email_enabled: boolean;
  dnd_start_hour: number;
  dnd_end_hour: number;
  max_notifs_per_day: number;
  expo_push_token: string | null;
  timezone: string;
}

interface HumanStateRow {
  interaction_risk: number;
  mood_score: number;
  energy_score: number;
}

type NotificationChannel = 'push' | 'email' | 'in_app';
type NotificationType =
  | 'birthday_reminder'
  | 'reconnect_suggestion'
  | 'signal_opportunity'
  | 'weekly_digest'
  | 'briefing_ready';

interface NotificationJob {
  userId:    string;
  type:      NotificationType;
  channels:  NotificationChannel[];
  title:     string;
  body:      string;
  urgency:   number;
  personId?: string;
  signalId?: string;
  meta:      Record<string, unknown>;
  emailPayload?: React.ReactElement;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localHour(date: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en', {
      hour: 'numeric', hour12: false, timeZone: tz,
    });
    const val = parseInt(fmt.format(date), 10);
    return Number.isNaN(val) ? date.getUTCHours() : val;
  } catch {
    return date.getUTCHours();
  }
}

function isInDND(hour: number, start: number, end: number): boolean {
  if (start > end) return hour >= start || hour < end; // spans midnight
  return hour >= start && hour < end;
}

function calcVulnerability(state: HumanStateRow | null): number {
  if (!state) return 0;
  return state.interaction_risk / 100;
}

function selectChannels(urgency: number, user: UserRow): NotificationChannel[] {
  const channels: NotificationChannel[] = ['in_app'];
  if (urgency >= 0.5 && user.push_enabled && user.expo_push_token) channels.push('push');
  if (urgency >= 0.8 && user.email_enabled) channels.push('email');
  return channels;
}

async function sendPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  });
}

async function sendEmail(
  to: string,
  subject: string,
  element: React.ReactElement
): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) return; // Graceful no-op if not configured
  const resend = new Resend(apiKey);
  await resend.emails.send({ from: EMAIL_FROM, to, subject, react: element });
}

// ─── Trigger evaluators ───────────────────────────────────────────────────────

async function evalReconnect(user: UserRow, now: Date): Promise<NotificationJob[]> {
  const db = getServiceClient();
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const { data: rels } = await db
    .from('relationships')
    .select('id, person_id, strength, stage, people(name)')
    .eq('user_id', user.id)
    .neq('stage', 'dormant')
    .or(`last_contact_at.is.null,last_contact_at.lt.${cutoff}`)
    .order('strength', { ascending: false })
    .limit(2);

  if (!rels?.length) return [];

  // Deduplicate: skip if sent in last 48h
  const { data: recent } = await db
    .from('notification_logs')
    .select('person_id')
    .eq('user_id', user.id)
    .eq('type', 'reconnect_suggestion')
    .gte('created_at', new Date(now.getTime() - 48 * 3_600_000).toISOString());

  const sentPersonIds = new Set((recent ?? []).map((r: { person_id: string | null }) => r.person_id));

  const jobs: NotificationJob[] = [];
  for (const rel of rels) {
    if (sentPersonIds.has(rel.person_id)) continue;
    const people = rel.people as { name?: string } | null;
    const name = people?.name ?? 'un contacto';
    const urgency = 0.5 + (rel.strength ?? 0.5) * 0.3;
    const channels = selectChannels(urgency, user);
    jobs.push({
      userId:  user.id,
      type:    'reconnect_suggestion',
      channels,
      title:   `Reconecta con ${name}`,
      body:    'Llevan más de 30 días sin contacto.',
      urgency,
      meta:    { person_name: name },
      ...(rel.person_id ? { personId: rel.person_id as string } : {}),
      ...(channels.includes('email') ? {
        emailPayload: React.createElement(ReconnectReminder, {
          userName: user.name,
          personName: name,
          daysSinceContact: 30,
          webUrl: WEB_URL,
        }),
      } : {}),
    });
  }
  return jobs;
}

async function evalSignalOpportunities(user: UserRow, now: Date): Promise<NotificationJob[]> {
  const db = getServiceClient();
  const cutoff24h = new Date(now.getTime() - 24 * 3_600_000).toISOString();

  const { data: signals } = await db
    .from('signals')
    .select('id, opportunity_score, action_recommendation, person_id, people(name)')
    .eq('user_id', user.id)
    .gt('opportunity_score', 70)
    .gte('processed_at', cutoff24h)
    .order('opportunity_score', { ascending: false })
    .limit(3);

  if (!signals?.length) return [];

  const { data: recent } = await db
    .from('notification_logs')
    .select('signal_id')
    .eq('user_id', user.id)
    .eq('type', 'signal_opportunity')
    .gte('created_at', new Date(now.getTime() - 48 * 3_600_000).toISOString());

  const sentSignalIds = new Set(
    (recent ?? []).map((r: { signal_id: string | null }) => r.signal_id)
  );

  const jobs: NotificationJob[] = [];
  for (const sig of signals) {
    if (sentSignalIds.has(sig.id)) continue;
    const people = sig.people as { name?: string } | null;
    const name = people?.name ?? 'un contacto';
    const score = (sig.opportunity_score as number) ?? 75;
    const urgency = Math.min(score / 100, 1);
    jobs.push({
      userId:   user.id,
      type:     'signal_opportunity',
      channels: selectChannels(urgency, user),
      title:    `Oportunidad con ${name}`,
      body:     (sig.action_recommendation as string) ?? `Score: ${score}`,
      urgency,
      signalId: sig.id as string,
      meta:     { score, person_name: name },
      ...(sig.person_id ? { personId: sig.person_id as string } : {}),
    });
  }
  return jobs;
}

async function evalBirthdays(user: UserRow, now: Date): Promise<NotificationJob[]> {
  const db = getServiceClient();
  const jobs: NotificationJob[] = [];

  for (let days = 0; days <= 7; days++) {
    const target = new Date(now.getTime() + days * 86_400_000);
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');

    const { data: people } = await db
      .from('people')
      .select('id, name, birthday')
      .eq('user_id', user.id)
      .not('birthday', 'is', null)
      .like('birthday', `%-${mm}-${dd}`);

    for (const person of people ?? []) {
      const { data: recent } = await db
        .from('notification_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'birthday_reminder')
        .eq('person_id', person.id)
        .gte('created_at', new Date(now.getTime() - 48 * 3_600_000).toISOString());
      if (recent?.length) continue;

      const urgency = days <= 1 ? 0.9 : 0.6;
      const channels = selectChannels(urgency, user);
      const personName = person.name as string;
      const birthDate = new Date(person.birthday as string)
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

      jobs.push({
        userId:   user.id,
        type:     'birthday_reminder',
        channels,
        title:    days === 0 ? `🎂 Hoy es el cumpleaños de ${personName}` : `🎂 Cumpleaños de ${personName} en ${days} días`,
        body:     `${personName} cumple años el ${birthDate}.`,
        urgency,
        personId: person.id as string,
        meta:     { days_until: days, birthday_date: birthDate },
        ...(channels.includes('email') ? {
          emailPayload: React.createElement(BirthdayAlert, {
            userName: user.name,
            personName,
            daysUntil: days,
            birthdayDate: birthDate,
            webUrl: WEB_URL,
          }),
        } : {}),
      });
    }
  }
  return jobs;
}

async function evalWeeklyDigest(user: UserRow, now: Date): Promise<NotificationJob[]> {
  if (now.getDay() !== 1) return []; // Monday only
  const hour = localHour(now, user.timezone);
  if (hour < 9 || hour >= 10) return [];

  // Only one weekly digest per week
  const db = getServiceClient();
  const weekStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: recent } = await db
    .from('notification_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'weekly_digest')
    .gte('created_at', weekStart);
  if (recent?.length) return [];

  // Fetch data for digest
  const { data: rels } = await db
    .from('relationships')
    .select('person_id, last_contact_at, people(name)')
    .eq('user_id', user.id)
    .neq('stage', 'dormant')
    .order('last_contact_at', { ascending: true })
    .limit(3);

  const { count: signalCount } = await db
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', weekStart);

  const topPeople = (rels ?? []).map((r) => {
    const people = r.people as { name?: string } | null;
    const days = r.last_contact_at
      ? Math.floor((now.getTime() - new Date(r.last_contact_at as string).getTime()) / 86_400_000)
      : 30;
    return { name: people?.name ?? '?', daysSinceContact: days };
  });

  const weekRange = `${new Date(now.getTime() - 7 * 86_400_000)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${
    now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;

  const digestChannels = selectChannels(0.7, user);
  return [{
    userId:   user.id,
    type:     'weekly_digest',
    channels: digestChannels,
    title:    'Tu resumen semanal de SIR',
    body:     `${signalCount ?? 0} señales capturadas. ${topPeople.length} personas a reconectar.`,
    urgency:  0.7,
    meta:     { week_range: weekRange, signal_count: signalCount ?? 0 },
    ...(digestChannels.includes('email') ? {
      emailPayload: React.createElement(WeeklyDigest, {
        userName: user.name,
        topPeople,
        signalCount: signalCount ?? 0,
        weekRange,
        webUrl: WEB_URL,
      }),
    } : {}),
  }];
}

async function evalBriefingReady(user: UserRow, now: Date): Promise<NotificationJob[]> {
  const hour = localHour(now, user.timezone);
  if (hour < 7 || hour >= 8) return [];

  const db = getServiceClient();
  const { data: recent } = await db
    .from('notification_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'briefing_ready')
    .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString());
  if (recent?.length) return [];

  return [{
    userId:   user.id,
    type:     'briefing_ready',
    channels: selectChannels(0.6, user),
    title:    'Tu briefing diario está listo',
    body:     'Empieza el día con inteligencia relacional.',
    urgency:  0.6,
    meta:     {},
  }];
}

// ─── Main engine ─────────────────────────────────────────────────────────────

async function processUser(user: UserRow, now: Date): Promise<number> {
  const db = getServiceClient();

  // 1. Get latest human state
  const { data: stateRows } = await db
    .from('human_state_logs')
    .select('interaction_risk, mood_score, energy_score')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const state: HumanStateRow | null = (stateRows?.[0] as HumanStateRow | undefined) ?? null;

  // 2. Suppression checks
  if (calcVulnerability(state) > 0.8) return 0;
  if (isInDND(localHour(now, user.timezone), user.dnd_start_hour, user.dnd_end_hour)) return 0;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const { count: dailyCount } = await db
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())
    .in('status', ['sent', 'pending']);
  if ((dailyCount ?? 0) >= user.max_notifs_per_day) return 0;

  // 3. Evaluate all triggers
  const [reconnects, opportunities, birthdays, digest, briefing] = await Promise.all([
    evalReconnect(user, now).catch(() => [] as NotificationJob[]),
    evalSignalOpportunities(user, now).catch(() => [] as NotificationJob[]),
    evalBirthdays(user, now).catch(() => [] as NotificationJob[]),
    evalWeeklyDigest(user, now).catch(() => [] as NotificationJob[]),
    evalBriefingReady(user, now).catch(() => [] as NotificationJob[]),
  ]);

  const jobs = [...birthdays, ...opportunities, ...reconnects, ...digest, ...briefing]
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, user.max_notifs_per_day - (dailyCount ?? 0));

  let sent = 0;
  for (const job of jobs) {
    for (const channel of job.channels) {
      const insertData = {
        user_id:       job.userId,
        type:          job.type,
        channel,
        title:         job.title,
        body:          job.body,
        urgency_score: job.urgency,
        status:        'pending' as const,
        metadata:      job.meta,
        ...(job.personId ? { person_id: job.personId } : {}),
        ...(job.signalId ? { signal_id: job.signalId } : {}),
      };

      const { data: log } = await db
        .from('notification_logs')
        .insert(insertData)
        .select('id')
        .single();

      let success = true;
      try {
        if (channel === 'push' && user.expo_push_token) {
          await sendPush(user.expo_push_token, job.title, job.body, job.meta);
        } else if (channel === 'email' && job.emailPayload) {
          await sendEmail(user.email, job.title, job.emailPayload);
        }
      } catch {
        success = false;
      }

      if (log?.id) {
        await db
          .from('notification_logs')
          .update({ status: success ? 'sent' : 'failed', sent_at: new Date().toISOString() })
          .eq('id', log.id);
      }
      if (success) sent++;
    }
  }
  return sent;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const db = getServiceClient();

  const { data: users, error } = await db
    .from('users')
    .select(
      'id, email, name, push_enabled, email_enabled, dnd_start_hour, dnd_end_hour, max_notifs_per_day, expo_push_token, timezone'
    )
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let totalSent = 0;
  const results: { userId: string; sent: number; error?: string }[] = [];

  for (const user of (users ?? []) as UserRow[]) {
    try {
      const sent = await processUser(user, now);
      totalSent += sent;
      results.push({ userId: user.id, sent });
    } catch (err) {
      results.push({ userId: user.id, sent: 0, error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    processedUsers: (users ?? []).length,
    totalSent,
    results,
  });
}
