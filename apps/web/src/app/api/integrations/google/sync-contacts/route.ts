import { type NextRequest } from 'next/server';
import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';
import { getValidToken, type GoogleIntegration } from '../_lib';

export const dynamic = 'force-dynamic';

interface GooglePerson {
  names?: Array<{ displayName: string }>;
  emailAddresses?: Array<{ value: string; metadata?: { primary?: boolean } }>;
  phoneNumbers?: Array<{ value: string }>;
  organizations?: Array<{ name: string; title?: string }>;
}

function makeSlug(name: string): string {
  return (
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 48) +
    '-' + Math.random().toString(36).slice(2, 6)
  );
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const specificId = req.nextUrl.searchParams.get('id');

  // Fetch one or all integrations
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

  // Pre-load all existing people for deduplication (shared across accounts)
  const { data: existingPeople, count: totalBefore } = await db
    .from('people')
    .select('id, name, email, phone, organization, role', { count: 'exact' })
    .eq('user_id', user.id);

  type ExistingPerson = { id: string; name: string; email: string | null; phone: string | null; organization: string | null; role: string | null };
  const byEmail = new Map<string, ExistingPerson>();
  const byName  = new Map<string, ExistingPerson>();

  for (const p of (existingPeople ?? []) as ExistingPerson[]) {
    if (p.email) byEmail.set(p.email.toLowerCase(), p);
    byName.set(normalizeName(p.name), p);
  }

  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
  const perAccount: Array<{ account_email: string | null; created: number; updated: number }> = [];

  for (const integration of integrations) {
    let token: string;
    try {
      token = await getValidToken(integration, user.id);
    } catch {
      continue; // skip expired/broken account
    }

    let created = 0, updated = 0, skipped = 0;
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        personFields: 'names,emailAddresses,phoneNumbers,organizations',
        pageSize: '1000',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json() as { connections?: GooglePerson[]; nextPageToken?: string };
      if (!res.ok) break;

      for (const contact of (data.connections ?? [])) {
        const name = contact.names?.[0]?.displayName?.trim();
        if (!name) continue;

        const emails = contact.emailAddresses ?? [];
        const rawEmail = emails.find(e => e.metadata?.primary)?.value ?? emails[0]?.value ?? null;
        const email = rawEmail?.toLowerCase() ?? null;

        const phone = contact.phoneNumbers?.[0]?.value ?? null;
        const org   = contact.organizations?.[0]?.name ?? null;
        const role  = contact.organizations?.[0]?.title ?? null;

        const existing = (email ? byEmail.get(email) : undefined) ?? byName.get(normalizeName(name));

        if (existing) {
          const patch: Record<string, string> = {};
          if (email && !existing.email) patch['email'] = email;
          if (phone && !existing.phone) patch['phone'] = phone;
          if (org   && !existing.organization) patch['organization'] = org;
          if (role  && !existing.role) patch['role'] = role;

          if (Object.keys(patch).length > 0) {
            await db.from('people').update(patch).eq('id', existing.id);
            if (patch['email']) {
              existing.email = patch['email'];
              byEmail.set(patch['email'], existing);
            }
            updated++;
          } else {
            skipped++;
          }
        } else {
          const { data: inserted } = await db.from('people').insert({
            user_id:           user.id,
            name,
            email,
            phone,
            organization:      org,
            role,
            relationship_type: 'networking',
            slug:              makeSlug(name),
          }).select('id').single();
          const realId = inserted?.id ?? 'unknown';
          const entry: ExistingPerson = { id: realId, name, email, phone, organization: org, role };
          if (email) byEmail.set(email, entry);
          byName.set(normalizeName(name), entry);
          created++;
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    await db.from('google_integrations').update({
      contacts_synced: created + updated,
      last_sync_at:    new Date().toISOString(),
    }).eq('id', integration.id);

    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;
    perAccount.push({ account_email: integration.account_email, created, updated });
  }

  const { count: totalAfter } = await db
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return Response.json({
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
    total_before: totalBefore,
    total_after:  totalAfter,
    accounts: perAccount,
  });
}
