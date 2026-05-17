'use client';

import { useState } from 'react';

export interface GoogleAccount {
  id: string;
  account_email: string | null;
  account_name: string | null;
  is_primary: boolean;
  contacts_synced: number;
  events_synced: number;
  last_sync_at: string | null;
}

interface Props {
  accounts: GoogleAccount[];
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function AccountRow({ account, onSynced, onDisconnected }: {
  account: GoogleAccount;
  onSynced: (id: string, contacts: number, events: number) => void;
  onDisconnected: (id: string) => void;
}) {
  const [syncing,       setSyncing]       = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [msg,           setMsg]           = useState('');
  const [err,           setErr]           = useState('');

  async function handleSync() {
    setSyncing(true);
    setMsg('');
    setErr('');
    try {
      const [cRes, calRes] = await Promise.all([
        fetch(`/api/integrations/google/sync-contacts?id=${account.id}`, { method: 'POST' }),
        fetch(`/api/integrations/google/sync-calendar?id=${account.id}`, { method: 'POST' }),
      ]);
      const cData   = await cRes.json()   as { created?: number; updated?: number; error?: string };
      const calData = await calRes.json() as { meetings_processed?: number; error?: string };

      if (!cRes.ok)   { setErr(cData.error   ?? 'Error sincronizando contactos'); return; }
      if (!calRes.ok) { setErr(calData.error  ?? 'Error sincronizando calendario'); return; }

      const newContacts = (cData.created ?? 0) + (cData.updated ?? 0);
      setMsg(`✓ ${newContacts} contactos, ${calData.meetings_processed ?? 0} reuniones`);
      onSynced(account.id, newContacts, calData.meetings_processed ?? 0);
    } catch {
      setErr('Error de red');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`¿Desconectar ${account.account_email ?? 'esta cuenta'}?`)) return;
    setDisconnecting(true);
    setErr('');
    try {
      const res = await fetch(`/api/integrations/google/disconnect?id=${account.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDisconnected(account.id);
      } else {
        setErr('Error al desconectar');
      }
    } catch {
      setErr('Error de red');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div style={{
      background: '#13151f',
      border: '1px solid #2a2d3e',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 14 }}>
            {account.account_email ?? 'Cuenta de Google'}
            {account.is_primary && (
              <span style={{
                marginLeft: 6,
                fontSize: 10, fontWeight: 700,
                background: '#6366f133', color: '#818cf8',
                borderRadius: 4, padding: '1px 6px',
              }}>
                PRINCIPAL
              </span>
            )}
          </p>
          {account.account_name && (
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{account.account_name}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '6px 12px',
              background: syncing ? '#2a2d3e' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #2a2d3e',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: disconnecting ? 'not-allowed' : 'pointer',
            }}
          >
            {disconnecting ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
        <span>{account.contacts_synced} contactos</span>
        <span>·</span>
        <span>{account.events_synced} reuniones</span>
        {account.last_sync_at && (
          <>
            <span>·</span>
            <span>Sync: {formatDate(account.last_sync_at)}</span>
          </>
        )}
      </div>

      {msg && (
        <p style={{ color: '#86efac', fontSize: 12, margin: '8px 0 0', background: '#bbf7d01a', padding: '4px 8px', borderRadius: 4 }}>
          {msg}
        </p>
      )}
      {err && (
        <p style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0', background: '#fca5a51a', padding: '4px 8px', borderRadius: 4 }}>
          {err}
        </p>
      )}
    </div>
  );
}

export default function GoogleCard({ accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<GoogleAccount[]>(initialAccounts);

  function handleSynced(id: string, contacts: number, events: number) {
    setAccounts(prev => prev.map(a =>
      a.id === id
        ? { ...a, contacts_synced: a.contacts_synced + contacts, events_synced: a.events_synced + events, last_sync_at: new Date().toISOString() }
        : a
    ));
  }

  function handleDisconnected(id: string) {
    setAccounts(prev => {
      const next = prev.filter(a => a.id !== id);
      // Promote first remaining to primary
      if (next.length > 0 && !next.some(a => a.is_primary)) {
        return next.map((a, i) => ({ ...a, is_primary: i === 0 }));
      }
      return next;
    });
  }

  const totalContacts = accounts.reduce((s, a) => s + a.contacts_synced, 0);
  const totalEvents   = accounts.reduce((s, a) => s + a.events_synced, 0);

  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2a2d3e',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#13151f', border: '1px solid #2a2d3e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            G
          </div>
          <div>
            <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>
              Google Contacts &amp; Calendar
            </p>
            <span style={{
              display: 'inline-block',
              fontSize: 11, fontWeight: 600,
              borderRadius: 20, padding: '2px 8px',
              background: accounts.length > 0 ? '#bbf7d033' : '#f1f5f933',
              color:      accounts.length > 0 ? '#86efac'   : '#64748b',
            }}>
              {accounts.length > 0
                ? `● ${accounts.length} cuenta${accounts.length > 1 ? 's' : ''} conectada${accounts.length > 1 ? 's' : ''}`
                : '○ No conectado'}
            </span>
          </div>
        </div>
      </div>

      {accounts.length > 0 && (
        <>
          {accounts.map(account => (
            <AccountRow
              key={account.id}
              account={account}
              onSynced={handleSynced}
              onDisconnected={handleDisconnected}
            />
          ))}

          {accounts.length > 1 && (
            <div style={{
              display: 'flex', gap: 16, marginTop: 8, marginBottom: 12,
              background: '#13151f', borderRadius: 8, padding: '10px 14px',
            }}>
              <div>
                <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Total contactos</p>
                <p style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>{totalContacts}</p>
              </div>
              <div style={{ width: 1, background: '#2a2d3e' }} />
              <div>
                <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Total reuniones</p>
                <p style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>{totalEvents}</p>
              </div>
            </div>
          )}

          <a
            href="/api/integrations/google/connect"
            style={{
              display: 'inline-block',
              padding: '7px 14px',
              background: 'transparent',
              color: '#818cf8',
              border: '1px solid #6366f144',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Conectar otra cuenta
          </a>
        </>
      )}

      {accounts.length === 0 && (
        <a
          href="/api/integrations/google/connect"
          style={{
            display: 'inline-block',
            padding: '9px 18px',
            background: '#6366f1',
            color: '#fff',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Conectar con Google
        </a>
      )}
    </div>
  );
}
