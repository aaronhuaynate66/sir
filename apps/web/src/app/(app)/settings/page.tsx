import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import SettingsForm from './SettingsForm';
import type { NotificationPrefs } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { data } = await getServiceClient()
    .from('users')
    .select('push_enabled, email_enabled, dnd_start_hour, dnd_end_hour, max_notifs_per_day, timezone')
    .eq('id', user.id)
    .single();

  const prefs: NotificationPrefs = {
    push_enabled:       (data as { push_enabled?: boolean } | null)?.push_enabled       ?? true,
    email_enabled:      (data as { email_enabled?: boolean } | null)?.email_enabled      ?? true,
    dnd_start_hour:     (data as { dnd_start_hour?: number } | null)?.dnd_start_hour     ?? 22,
    dnd_end_hour:       (data as { dnd_end_hour?: number } | null)?.dnd_end_hour         ?? 8,
    max_notifs_per_day: (data as { max_notifs_per_day?: number } | null)?.max_notifs_per_day ?? 3,
    timezone:           (data as { timezone?: string } | null)?.timezone                 ?? 'UTC',
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Configuración
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>
          Preferencias de notificaciones y zona horaria
        </p>
      </div>
      <SettingsForm initial={prefs} />

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #2a2d3e' }}>
        <Link
          href="/settings/privacy"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#94a3b8', fontSize: 13, textDecoration: 'none',
          }}
        >
          Privacidad y datos →
        </Link>
      </div>
    </div>
  );
}
