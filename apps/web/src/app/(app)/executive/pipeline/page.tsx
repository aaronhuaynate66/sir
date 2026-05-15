import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import PipelineKanban from './PipelineKanban';

export const dynamic = 'force-dynamic';

export type PipelineCard = {
  personId: string;
  name: string;
  role: string | null;
  organization: string | null;
  slug: string | null;
  daysSinceContact: number | null;
  opportunityScore: number | null;
  relationshipType: string;
  stage: string;
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db         = getServiceClient();
  const typeFilter = searchParams?.type ?? '';

  let peopleQuery = db.from('people')
    .select('id, name, role, organization, relationship_type, slug')
    .eq('user_id', user.id);

  if (typeFilter) {
    peopleQuery = peopleQuery.eq('relationship_type', typeFilter) as typeof peopleQuery;
  }

  const [{ data: peopleData }, { data: relsData }, { data: oppsData }] = await Promise.all([
    peopleQuery,
    db.from('relationships').select('person_id, strength, last_contact_at, stage').eq('user_id', user.id),
    db.from('signals')
      .select('person_id, opportunity_score')
      .eq('user_id', user.id)
      .not('signal_type', 'is', null)
      .not('opportunity_score', 'is', null)
      .order('opportunity_score', { ascending: false }),
  ]);

  type PersonRow = { id: string; name: string; role: string | null; organization: string | null; relationship_type: string; slug: string | null };
  type RelRow    = { person_id: string; strength: number; last_contact_at: string | null; stage: string };
  type OppRow    = { person_id: string | null; opportunity_score: number };

  const people = (peopleData ?? []) as PersonRow[];
  const rels   = (relsData   ?? []) as RelRow[];
  const opps   = (oppsData   ?? []) as OppRow[];

  const relMap = new Map(rels.map(r => [r.person_id, r]));
  const oppMap = new Map<string, number>();
  for (const o of opps) {
    if (o.person_id && !oppMap.has(o.person_id)) {
      oppMap.set(o.person_id, o.opportunity_score);
    }
  }

  const now = Date.now();
  const cards: PipelineCard[] = people.map(p => {
    const rel = relMap.get(p.id);
    const lastMs = rel?.last_contact_at ? new Date(rel.last_contact_at).getTime() : null;
    const daysSince = lastMs !== null ? Math.floor((now - lastMs) / 86_400_000) : null;
    return {
      personId: p.id,
      name: p.name,
      role: p.role,
      organization: p.organization,
      slug: p.slug,
      daysSinceContact: daysSince,
      opportunityScore: oppMap.get(p.id) ?? null,
      relationshipType: p.relationship_type,
      stage: rel?.stage ?? 'prospect',
    };
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Relationship Pipeline</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{cards.length} contactos · arrastra para cambiar de etapa</p>
      </div>
      <PipelineKanban initialCards={cards} typeFilter={typeFilter} />
    </div>
  );
}
