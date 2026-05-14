import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import type { DbNotificationLog } from '@sir/db';
import NotificationList from './NotificationList';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { data } = await getServiceClient()
    .from('notification_logs')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60);

  const logs = (data ?? []) as DbNotificationLog[];
  const unread = logs.filter(l => l.status !== 'read').length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Notificaciones
          {unread > 0 && (
            <span style={{
              marginLeft: 10,
              fontSize: 13,
              background: '#818cf8',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 600,
              verticalAlign: 'middle',
            }}>
              {unread}
            </span>
          )}
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>
          Historial de alertas y recordatorios
        </p>
      </div>

      <NotificationList initialLogs={logs} />
    </div>
  );
}
