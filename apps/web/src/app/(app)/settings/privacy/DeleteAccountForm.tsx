'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteAccountForm() {
  const router = useRouter();
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [open,    setOpen]    = useState(false);

  const REQUIRED = 'ELIMINAR MI CUENTA';

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/privacy/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirmation: input }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Error al eliminar cuenta');
      }
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent', border: '1px solid #ef4444', borderRadius: 8,
          color: '#ef4444', fontSize: 13, fontWeight: 600, padding: '9px 18px', cursor: 'pointer',
        }}
      >
        Eliminar mi cuenta
      </button>
    );
  }

  return (
    <div style={{ background: '#1a0a0a', border: '1px solid #ef444455', borderRadius: 10, padding: 20 }}>
      <p style={{ color: '#fca5a5', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
        ⚠ Esta acción es irreversible
      </p>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
        Se eliminarán permanentemente: todas tus memorias, señales, relaciones, personas, estados y datos de analytics.
        Escribe <strong style={{ color: '#fca5a5' }}>{REQUIRED}</strong> para confirmar.
      </p>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={REQUIRED}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px', marginBottom: 12,
          background: '#12141f', border: '1px solid #2a2d3e', borderRadius: 8,
          color: '#e2e8f0', fontSize: 13, outline: 'none',
        }}
      />
      {error && <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleDelete}
          disabled={input !== REQUIRED || loading}
          style={{
            background: input === REQUIRED ? '#ef4444' : '#2a2d3e',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 13, fontWeight: 600, padding: '9px 18px', cursor: input === REQUIRED ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Eliminando...' : 'Confirmar eliminación'}
        </button>
        <button
          onClick={() => { setOpen(false); setInput(''); setError(null); }}
          style={{ background: 'transparent', border: '1px solid #2a2d3e', borderRadius: 8, color: '#94a3b8', fontSize: 13, padding: '9px 18px', cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
