import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import type { DbPerson, PersonRelationshipType } from '@sir/db';
import NewPersonButton from './NewPersonButton';

export const dynamic = 'force-dynamic';

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }
function initials(name: string) { return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }

const STAGE_LABEL: Record<string, string> = {
  active: 'Activa', strategic: 'Estratégica', prospect: 'Prospecto', dormant: 'Dormida',
};
const STAGE_COLOR: Record<string, string> = {
  active: '#86efac', strategic: '#fcd34d', prospect: '#93c5fd', dormant: '#d1d5db',
};

const REL_TYPE_COLORS: Record<PersonRelationshipType, string> = {
  strategic:    '#a855f7',
  professional: '#3b82f6',
  personal:     '#22c55e',
  family:       '#f97316',
  networking:   '#94a3b8',
  developing:   '#eab308',
};

const REL_TYPE_LABELS: Record<PersonRelationshipType, string> = {
  networking:   '🤝 Networking',
  professional: '👔 Profesional',
  strategic:    '🎯 Estratégico',
  personal:     '❤️ Personal',
  family:       '👨‍👩‍👧 Familia',
  developing:   '🌱 Por desarrollar',
};

const FILTER_CHIPS: Array<{ value: PersonRelationshipType | 'all'; label: string }> = [
  { value: 'all',          label: 'Todos' },
  { value: 'strategic',    label: '🎯 Estratégico' },
  { value: 'professional', label: '👔 Profesional' },
  { value: 'personal',     label: '❤️ Personal' },
  { value: 'family',       label: '👨‍👩‍👧 Familia' },
  { value: 'networking',   label: '🤝 Networking' },
  { value: 'developing',   label: '🌱 Por desarrollar' },
];

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const typeFilter = (searchParams?.type ?? '') as PersonRelationshipType | '';

  let peopleQuery = db
    .from('people')
    .select('id, name, organization, role, email, notes, relationship_type, created_at')
    .eq('user_id', user.id)
    .order('name');

  if (typeFilter) {
    peopleQuery = peopleQuery.eq('relationship_type', typeFilter) as typeof peopleQuery;
  }

  const [{ data: peopleData }, { data: relsData }] = await Promise.all([
    peopleQuery,
    db.from('relationships').select('person_id, strength, stage').eq('user_id', user.id),
  ]);

  const people = (peopleData ?? []) as (DbPerson & { relationship_type: PersonRelationshipType })[];
  const relMap = new Map(
    ((relsData ?? []) as Array<{ person_id: string; strength: number; stage: string }>)
      .map(r => [r.person_id, r])
  );

  const activeFilter = typeFilter || 'all';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Personas</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            {people.length} contacto{people.length !== 1 ? 's' : ''} en tu red
          </p>
        </div>
        <NewPersonButton />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {FILTER_CHIPS.map(chip => {
          const isActive = activeFilter === chip.value;
          const color = chip.value !== 'all' ? REL_TYPE_COLORS[chip.value as PersonRelationshipType] : '#818cf8';
          return (
            <Link
              key={chip.value}
              href={chip.value === 'all' ? '/people' : `/people?type=${chip.value}`}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                background: isActive ? color + '33' : '#1a1d27',
                border: `1px solid ${isActive ? color : '#2a2d3e'}`,
                color: isActive ? color : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>

      {people.length === 0 ? (
        <div style={{ background: '#1a1d27', border: '1px dashed #2a2d3e', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#475569', fontSize: 16, marginBottom: 8 }}>
            {activeFilter !== 'all' ? `Sin contactos de tipo "${REL_TYPE_LABELS[activeFilter as PersonRelationshipType]}".` : 'No hay personas registradas todavía.'}
          </p>
          <p style={{ color: '#334155', fontSize: 13 }}>
            {activeFilter !== 'all' ? (
              <Link href="/people" style={{ color: '#818cf8', textDecoration: 'none' }}>Ver todos los contactos →</Link>
            ) : (
              'Crea tu primer contacto con el botón de arriba.'
            )}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {people.map(person => {
            const rel     = relMap.get(person.id);
            const strength = rel?.strength ?? null;
            const stage    = rel?.stage ?? null;
            const relType  = (person.relationship_type ?? 'networking') as PersonRelationshipType;
            const typeColor = REL_TYPE_COLORS[relType];

            return (
              <Link key={person.id} href={`/people/${person.id}`} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(person.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                  }}>
                    {initials(person.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {person.name}
                    </p>
                    {person.organization || person.role ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[person.role, person.organization].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Relationship type badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: typeColor + '22',
                    border: `1px solid ${typeColor}44`,
                    color: typeColor,
                    borderRadius: 10, padding: '2px 8px',
                  }}>
                    {REL_TYPE_LABELS[relType]}
                  </span>

                  {stage && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      background: STAGE_COLOR[stage] ?? '#d1d5db',
                      color: '#111', borderRadius: 10, padding: '2px 8px',
                    }}>
                      {STAGE_LABEL[stage] ?? stage}
                    </span>
                  )}
                  {strength !== null && (
                    <span style={{ fontSize: 12, color: strength >= 70 ? '#34d399' : strength >= 40 ? '#fbbf24' : '#f87171', fontWeight: 600, marginLeft: 'auto' }}>
                      {strength} fuerza
                    </span>
                  )}
                </div>

                {person.notes && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {person.notes}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  display: 'block',
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 14,
  padding: 18,
  textDecoration: 'none',
  transition: 'border-color 0.15s',
};
