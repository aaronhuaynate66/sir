import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import RitualsList from './RitualsList';

export const dynamic = 'force-dynamic';

interface RitualRow {
  id:               string;
  person_id:        string | null;
  type:             string;
  message:          string;
  action_suggestion: string | null;
  priority:         number;
  read_at:          string | null;
  dismissed_at:     string | null;
  created_at:       string;
  people?: { name: string; slug: string } | null;
}

export default async function RitualesPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { data } = await getServiceClient()
    .from('ritual_suggestions')
    .select('id, person_id, type, message, action_suggestion, priority, read_at, dismissed_at, created_at, people(name, slug)')
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  type RitualRaw = Omit<RitualRow, 'people'> & { people: Array<{ name: string; slug: string }> | null };
  const suggestions: RitualRow[] = ((data ?? []) as unknown as RitualRaw[]).map(r => ({
    ...r, people: Array.isArray(r.people) ? (r.people[0] ?? null) : r.people,
  }));

  const TYPE_ICON: Record<string, string> = {
    no_contact:            '⏰',
    birthday:              '🎂',
    anniversary:           '💑',
    job_change_followup:   '💼',
    achievement_acknowledge: '🏆',
    strength_declining:    '📉',
    custom_date:           '📅',
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Rituales relacionales</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Sugerencias proactivas para mantener y fortalecer tus relaciones.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div style={{
          background: '#1a1d27', border: '1px dashed #2a2d3e',
          borderRadius: 14, padding: 48, textAlign: 'center',
        }}>
          <p style={{ color: '#475569', fontSize: 16, margin: '0 0 8px' }}>Sin rituales pendientes</p>
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>
            Las sugerencias se generan automáticamente basadas en tus relaciones.
          </p>
        </div>
      ) : (
        <RitualsList suggestions={suggestions.map(s => ({
          id:               s.id,
          personId:         s.person_id,
          personName:       (s.people as { name: string; slug: string } | null)?.name ?? null,
          personSlug:       (s.people as { name: string; slug: string } | null)?.slug ?? null,
          type:             s.type,
          icon:             TYPE_ICON[s.type] ?? '🔔',
          message:          s.message,
          actionSuggestion: s.action_suggestion,
          priority:         s.priority,
          createdAt:        s.created_at,
        }))} />
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/inicio" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none' }}>← Volver al inicio</Link>
      </div>
    </div>
  );
}
