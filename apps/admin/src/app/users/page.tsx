export const dynamic = 'force-dynamic';

import { getAdminClient } from '@/lib/supabase-server';

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

async function getUsersWithStats() {
  const db = await getAdminClient();

  const { data: users, error } = await db
    .from('users')
    .select('id, email, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !users) return [];

  const stats = await Promise.all(
    (users as UserRow[]).map(async (u) => {
      const [signals, memories, people] = await Promise.all([
        db.from('signals').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        db.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        db.from('people').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      ]);
      return {
        ...u,
        signalCount:  signals.count  ?? 0,
        memoryCount:  memories.count ?? 0,
        peopleCount:  people.count   ?? 0,
      };
    })
  );

  return stats;
}

export default async function UsersPage() {
  const users = await getUsersWithStats();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Usuarios</h1>
        <span style={{ fontSize: 13, color: '#6b7280', background: '#e5e7eb', borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>
          {users.length} registrado{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Email', 'Señales', 'Memorias', 'Personas', 'Registro'].map(h => (
                <th
                  key={h}
                  style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  Sin usuarios registrados
                </td>
              </tr>
            ) : users.map((u, i) => (
              <tr key={u.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{u.email}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af', marginTop: 2 }}>{u.id.slice(0, 12)}…</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Chip value={u.signalCount} color="#dbeafe" text="#1d4ed8" />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Chip value={u.memoryCount} color="#ede9fe" text="#6d28d9" />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Chip value={u.peopleCount} color="#dcfce7" text="#15803d" />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                  {new Date(u.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ value, color, text }: { value: number; color: string; text: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: color, color: text,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 12, fontWeight: 700,
      minWidth: 28, textAlign: 'center',
    }}>
      {value}
    </span>
  );
}
