'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

interface Props {
  personId:   string;
  personName: string;
}

interface Result {
  messages_processed: number;
  memories_created:   number;
  signals_created:    number;
  tone:               string;
  insights:           string[];
  day_span:           number;
  weekly_rate:        string;
}

export default function WhatsAppUploadButton({ personId, personName }: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState('');
  const [result,  setResult]  = useState<Result | null>(null);
  const [error,   setError]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setError('');
    setStatus('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);
    setStatus('Subiendo archivo…');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('No autenticado'); setLoading(false); return; }

    const storagePath = `${user.id}/${Date.now()}-chat.txt`;
    const { error: uploadError } = await supabase.storage
      .from('whatsapp-exports')
      .upload(storagePath, file, { contentType: 'text/plain', upsert: true });

    if (uploadError) {
      setError(`Error al subir: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    setStatus('Analizando con IA…');

    try {
      const res = await fetch(`/api/people/${personId}/whatsapp-import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storage_path: storagePath }),
      });

      let data: Result & { error?: string };
      try {
        data = await res.json() as typeof data;
      } catch {
        setError(`Error del servidor (${res.status})`);
        return;
      }

      if (!res.ok) { setError(data.error ?? `Error ${res.status}`); return; }
      setResult(data);
    } catch (e) {
      setError(`Error de red: ${String(e)}`);
    } finally {
      setLoading(false);
      setStatus('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const TONE_COLOR: Record<string, string> = {
    cálido: '#34d399', neutral: '#94a3b8', formal: '#93c5fd', tenso: '#f87171',
  };

  return (
    <div>
      <button
        onClick={() => { setOpen(o => !o); reset(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          background: open ? '#1a2e1a' : '#13151f',
          border: `1px solid ${open ? '#25d366' : '#2a2d3e'}`,
          borderRadius: 8, color: open ? '#25d366' : '#64748b',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        💬 Chat WhatsApp
      </button>

      {open && (
        <div style={{
          marginTop: 8,
          background: '#13151f',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          padding: '14px 16px',
          width: 260,
        }}>
          {!result ? (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                Exporta el chat con <strong style={{ color: '#e2e8f0' }}>{personName}</strong> desde WhatsApp
                (3 puntos → Exportar chat → Sin archivos) y sube el .txt aquí.
              </p>

              <label style={{
                display: 'inline-block',
                padding: '7px 14px',
                background: loading ? '#1a2e1a' : '#25d36622',
                border: '1px solid #25d36644',
                borderRadius: 7, color: loading ? '#475569' : '#25d366',
                fontSize: 12, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? (status || 'Procesando…') : '📂 Seleccionar archivo .txt'}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFile}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>

              {error && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#fca5a5', background: '#fca5a51a', padding: '5px 8px', borderRadius: 5 }}>
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#86efac' }}>
                ✓ Chat procesado
              </p>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
                <div>📨 {result.messages_processed.toLocaleString()} mensajes · {result.day_span} días</div>
                <div>📊 {result.weekly_rate}/semana · tono{' '}
                  <span style={{ color: TONE_COLOR[result.tone] ?? '#94a3b8', fontWeight: 600 }}>
                    {result.tone}
                  </span>
                </div>
                <div>🧠 {result.memories_created} memoria{result.memories_created !== 1 ? 's' : ''} · {result.signals_created} señal{result.signals_created !== 1 ? 'es' : ''}</div>
              </div>
              {result.insights.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid #2a2d3e', paddingTop: 8 }}>
                  {result.insights.map((ins, i) => (
                    <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                      • {ins}
                    </p>
                  ))}
                </div>
              )}
              <button
                onClick={reset}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#6366f1', fontSize: 11, cursor: 'pointer', padding: 0 }}
              >
                Subir otro chat →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
