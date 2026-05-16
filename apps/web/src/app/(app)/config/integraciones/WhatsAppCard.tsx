'use client';

import { useState, useRef } from 'react';

interface ImportEntry {
  contact: string;
  person:  string;
  messages: number;
}

interface HistoryItem {
  date:     string;
  matched:  number;
  contacts: ImportEntry[];
}

async function readFileAsText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf.slice(0, 4));
  // Detect UTF-16 BOM
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  return new TextDecoder('utf-8').decode(buf);
}

export default function WhatsAppCard() {
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<{ matched: number; contacts: ImportEntry[] } | null>(null);
  const [errMsg,       setErrMsg]       = useState('');
  const [history,      setHistory]      = useState<HistoryItem[]>([]);
  const [userName,     setUserName]     = useState('');
  const [showHistory,  setShowHistory]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrMsg('');
    setResult(null);

    try {
      const content = await readFileAsText(file);
      const res = await fetch('/api/integrations/whatsapp/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content, userDisplayName: userName }),
      });
      const data = await res.json() as {
        matched?: number; contacts?: ImportEntry[]; processed?: number; message?: string; error?: string;
      };
      if (!res.ok) { setErrMsg(data.error ?? 'Error al importar'); return; }

      const matched   = data.matched ?? 0;
      const contacts  = data.contacts ?? [];
      setResult({ matched, contacts });

      if (matched > 0) {
        setHistory(prev => [{ date: new Date().toLocaleString('es-ES'), matched, contacts }, ...prev.slice(0, 9)]);
      }
    } catch {
      setErrMsg('Error al leer el archivo');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2a2d3e',
      borderRadius: 12,
      padding: '20px 24px',
      marginTop: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#13151f', border: '1px solid #2a2d3e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          💬
        </div>
        <div>
          <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>WhatsApp Export</p>
          <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Importa historial de conversaciones</p>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#13151f', border: '1px solid #2a2d3e',
        borderRadius: 8, padding: '12px 14px', marginBottom: 16,
        fontSize: 13, color: '#94a3b8', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Cómo exportar:</strong>
        <ol style={{ margin: '0 0 0 16px', padding: 0 }}>
          <li>Abre WhatsApp → selecciona un chat</li>
          <li>Toca los 3 puntos → <em>Exportar chat</em></li>
          <li>Elige <em>Sin archivos</em></li>
          <li>Guarda el archivo .txt y súbelo aquí</li>
        </ol>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
          Tu nombre en WhatsApp (opcional, para filtrar tus mensajes)
        </label>
        <input
          type="text"
          placeholder="Ej: Juan García"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px',
            background: '#13151f', border: '1px solid #2a2d3e',
            borderRadius: 6, color: '#e2e8f0', fontSize: 13,
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      <label style={{
        display: 'inline-block',
        padding: '9px 18px',
        background: loading ? '#2a2d3e' : '#6366f1',
        color: '#fff',
        borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? 'Procesando…' : 'Subir archivo .txt'}
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          onChange={handleFile}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </label>

      {errMsg && (
        <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 10, background: '#fca5a51a', padding: '6px 10px', borderRadius: 6 }}>
          {errMsg}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 14, background: '#13151f', borderRadius: 8, padding: '12px 14px' }}>
          <p style={{ color: '#86efac', fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>
            ✓ {result.matched} contacto{result.matched !== 1 ? 's' : ''} analizados
          </p>
          {result.contacts.map(c => (
            <div key={c.contact} style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
              <span style={{ color: '#94a3b8' }}>{c.person}</span> — {c.messages} mensajes
            </div>
          ))}
          {result.matched === 0 && (
            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
              No se encontraron coincidencias. Asegúrate de que los nombres en WhatsApp coincidan con los de tu red.
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            {showHistory ? 'Ocultar historial' : `Ver historial (${history.length})`}
          </button>
          {showHistory && (
            <div style={{ marginTop: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  fontSize: 12, color: '#475569', marginBottom: 4,
                  padding: '4px 8px', background: '#13151f', borderRadius: 4,
                }}>
                  {h.date} — {h.matched} contacto{h.matched !== 1 ? 's' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
