import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import StakeholderGraph from './StakeholderGraph';

export const dynamic = 'force-dynamic';

export type StakeholderPerson = {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  email: string | null;
  slug: string | null;
  relationship_type: string;
  strength: number;
  lastContact: string | null;
  lastBriefing: string | null;
  opportunityScore: number | null;
};

export default async function StakeholdersPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();

  const [{ data: peopleData }, { data: relsData }, { data: briefingsData }, { data: oppsData }] = await Promise.all([
    db.from('people')
      .select('id, name, role, organization, email, slug, relationship_type')
      .eq('user_id', user.id)
      .in('relationship_type', ['strategic', 'professional']),
    db.from('relationships')
      .select('person_id, strength, last_contact_at')
      .eq('user_id', user.id),
    db.from('briefings')
      .select('person_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('signals')
      .select('person_id, opportunity_score')
      .eq('user_id', user.id)
      .not('signal_type', 'is', null)
      .not('opportunity_score', 'is', null)
      .order('opportunity_score', { ascending: false }),
  ]);

  type PersonRow  = { id: string; name: string; role: string | null; organization: string | null; email: string | null; slug: string | null; relationship_type: string };
  type RelRow     = { person_id: string; strength: number; last_contact_at: string | null };
  type BriefRow   = { person_id: string | null; created_at: string };
  type OppRow     = { person_id: string | null; opportunity_score: number };

  const people   = (peopleData   ?? []) as PersonRow[];
  const rels     = (relsData     ?? []) as RelRow[];
  const briefings = (briefingsData ?? []) as BriefRow[];
  const opps     = (oppsData     ?? []) as OppRow[];

  const relMap = new Map(rels.map(r => [r.person_id, r]));

  // Latest briefing per person
  const briefingMap = new Map<string, string>();
  for (const b of briefings) {
    if (b.person_id && !briefingMap.has(b.person_id)) {
      briefingMap.set(b.person_id, b.created_at);
    }
  }

  // Best opportunity score per person
  const oppMap = new Map<string, number>();
  for (const o of opps) {
    if (o.person_id && !oppMap.has(o.person_id)) {
      oppMap.set(o.person_id, o.opportunity_score);
    }
  }

  const stakeholders: StakeholderPerson[] = people.map(p => {
    const rel = relMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      organization: p.organization,
      email: p.email,
      slug: p.slug,
      relationship_type: p.relationship_type,
      strength: rel?.strength ?? 50,
      lastContact: rel?.last_contact_at ?? null,
      lastBriefing: briefingMap.get(p.id) ?? null,
      opportunityScore: oppMap.get(p.id) ?? null,
    };
  });

  const ranked = [...stakeholders].sort((a, b) => {
    const aScore = a.strength * (a.relationship_type === 'strategic' ? 1.5 : 1);
    const bScore = b.strength * (b.relationship_type === 'strategic' ? 1.5 : 1);
    return bScore - aScore;
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Stakeholder Map</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          {stakeholders.filter(s => s.relationship_type === 'strategic').length} estratégicos ·{' '}
          {stakeholders.filter(s => s.relationship_type === 'professional').length} profesionales
        </p>
      </div>
      <StakeholderGraph stakeholders={stakeholders} ranked={ranked} />
    </div>
  );
}
