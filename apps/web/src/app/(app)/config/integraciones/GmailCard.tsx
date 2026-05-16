'use client';

import { useState } from 'react';

interface Props {
  connected:    boolean;
  emailsSynced: number;
  lastSyncAt:   string | null;
}

export default function GmailCard({ connected, emailsSynced, lastSyncAt }: Props) {
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState('');
  const [errMsg,   setErrMsg]   = useState('');
  const [localEmails,   setLocalEmails]   = useState(emailsSynced);
  const [localLastSync, setLocalLastSync] = useState(lastSyncAt);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    setErrMsg('');
    try {
      const res  = await fetch('/api/integrations/gmail/sync', { method: 'POST' });
      const data = await res.json() as { emails_processed?: number; contacts_analyzed?: number; error?: string };
      if (!res.ok) { setErrMsg(data.error ?? 'Error al sincronizar Gmail'); return; }
      setLocalEmails(data.emails_processed ?? 0);
      setLocalLastSync(new Date().toISOString());
      setSyncMsg(`✓ ${data.emails_processed ?? 0} emails, ${data.contacts_analyzed ?? 0} contactos analizados`);
    } catch {
      setErrMsg('Error de red');
    } finally {
      setSyncing(false);
    }
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2a2d3e',
      borderRadius: 12,
      padding: '20px 24px',
      marginTop: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#13151f', border: '1px solid #2a2d3e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#e2e8f0',
          }}>
            ✉
          </div>
          <div>
            <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>Gmail</p>
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 600,
              borderRadius: 20, padding: '2px 8px',
              background: connected ? '#bbf7d033' : '#f1f5f933',
              color:      connected ? '#86efac'   : '#64748b',
            }}>
              {connected ? '● Conectado' : '○ No conectado'}
            </span>
          </div>
        </div>
      </div>

      {connected && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 14,
          background: '#13151f', borderRadius: 8, padding: '10px 14px',
        }}>
          <div>
            <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Emails procesados</p>
            <p style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>{localEmails}</p>
          </div>
          {localLastSync && (
            <>
              <div style={{ width: 1, background: '#2a2d3e' }} />
              <div>
                <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Última sync</p>
                <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500, margin: 0 }}>{formatDate(localLastSync)}</p>
              </div>
            </>
          )}
        </div>
      )}

      {!connected && (
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 14px' }}>
          Analiza tus emails para detectar frecuencia de contacto, temas recurrentes y tono de cada relación.
        </p>
      )}

      {syncMsg && (
        <p style={{ color: '#86efac', fontSize: 13, margin: '0 0 12px', background: '#bbf7d01a', padding: '6px 10px', borderRadius: 6 }}>
          {syncMsg}
        </p>
      )}
      {errMsg && (
        <p style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 12px', background: '#fca5a51a', padding: '6px 10px', borderRadius: 6 }}>
          {errMsg}
        </p>
      )}

      {!connected ? (
        <a
          href="/api/integrations/gmail/connect"
          style={{
            display: 'inline-block', padding: '9px 18px',
            background: '#6366f1', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Conectar Gmail
        </a>
      ) : (
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '9px 18px',
            background: syncing ? '#2a2d3e' : '#6366f1',
            color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          {syncing ? 'Analizando…' : 'Sincronizar ahora'}
        </button>
      )}
    </div>
  );
}
