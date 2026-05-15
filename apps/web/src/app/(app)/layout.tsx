import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import Sidebar from '@/components/Sidebar';
import PostHogProvider from '@/components/PostHogProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { count } = await getServiceClient()
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'read')
    .then(r => r, () => ({ count: 0, data: null, error: null }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <PostHogProvider userId={user.id} userEmail={user.email ?? undefined} />
      <Sidebar userEmail={user.email ?? ''} unreadCount={count ?? 0} />
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
