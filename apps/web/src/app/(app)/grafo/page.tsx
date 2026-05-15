import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import RelationshipGraph from './RelationshipGraph';
import type { DbPerson, DbRelationship } from '@sir/db';
import { trackServerEvent, EVENTS } from '@sir/analytics';

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();

  const [{ data: peopleData }, { data: relsData }] = await Promise.all([
    db.from('people').select('*').eq('user_id', user.id).order('name'),
    db.from('relationships').select('*').eq('user_id', user.id),
  ]);

  const people = (peopleData ?? []) as DbPerson[];
  const rels   = (relsData   ?? []) as DbRelationship[];
  trackServerEvent(user.id, EVENTS.GRAPH_VIEWED, { people_count: people.length });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Grafo de relaciones</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          {(peopleData ?? []).length} persona{(peopleData ?? []).length !== 1 ? 's' : ''} en tu red
        </p>
      </div>
      <RelationshipGraph
        userName={user.email?.split('@')[0] ?? 'Tú'}
        people={people}
        relationships={rels}
      />
    </div>
  );
}
