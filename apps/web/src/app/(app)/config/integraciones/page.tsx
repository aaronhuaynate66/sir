import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import GoogleCard from './GoogleCard';
import GmailCard from './GmailCard';

export const dynamic = 'force-dynamic';

interface GoogleIntegrationRow {
  access_token:       string | null;
  scopes:             string[];
  last_sync_at:       string | null;
  contacts_synced:    number;
  events_synced:      number;
  emails_synced:      number;
  gmail_last_sync_at: string | null;
}

export default async function IntegracionesPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { data } = await getServiceClient()
    .from('google_integrations')
    .select('access_token, scopes, last_sync_at, contacts_synced, events_synced, emails_synced, gmail_last_sync_at')
    .eq('user_id', user.id)
    .single();

  const row = data as GoogleIntegrationRow | null;
  const scopes = row?.scopes ?? [];

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>
          Integraciones
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Conecta tus herramientas para enriquecer tu red automáticamente.
        </p>
      </div>

      <GoogleCard
        connected={!!row?.access_token}
        lastSyncAt={row?.last_sync_at ?? null}
        contactsSynced={row?.contacts_synced ?? 0}
        eventsSynced={row?.events_synced ?? 0}
      />

      <GmailCard
        connected={scopes.includes('gmail.readonly')}
        emailsSynced={row?.emails_synced ?? 0}
        lastSyncAt={row?.gmail_last_sync_at ?? null}
      />

      {/* Coming soon */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(['WhatsApp Export', 'Outlook', 'iCloud Contacts'] as const).map(name => (
          <div key={name} style={{
            background: '#1a1d27',
            border: '1px solid #2a2d3e',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 0.5,
          }}>
            <div>
              <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>{name}</p>
              <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Próximamente</p>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: '#2a2d3e', color: '#64748b',
              borderRadius: 6, padding: '3px 8px',
            }}>
              PRONTO
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
