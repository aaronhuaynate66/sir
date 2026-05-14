'use client';

import { useCallback, useEffect, useState } from 'react';

interface BriefingResult {
  content: string;
  tokens: number;
  costUsd: number;
}

function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return <p key={i} style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.replace('## ', '')}</p>;
    }
    if (line.startsWith('• ') || line.match(/^\d+\. /)) {
      return <p key={i} style={{ fontSize: 13, color: '#e2e8f0', margin: '4px 0', lineHeight: 1.6, paddingLeft: 4 }}>{line}</p>;
    }
    if (line.trim() === '') return null;
    return <p key={i} style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0' }}>{line}</p>;
  });
}

export default function ExecutiveBriefingWidget() {
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/briefing/executive');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json() as BriefingResult;
      setResult(data);
      setExpanded(true);
    } catch {
      setResult({ content: 'No se pudo cargar el briefing ejecutivo. Intenta de nuevo.', tokens: 0, costUsd: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return (
    <div style={{ marginBottom: 28, background: '#1a1d27', border: '1px solid #312e81', borderRadius: 12, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>◈</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Briefing ejecutivo semanal</span>
          {result && <span style={{ fontSize: 10, color: '#475569' }}>{result.tokens > 0 ? `${result.tokens} tokens` : 'estático'}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <span style={{ fontSize: 12, color: '#64748b' }}>Generando…</span>}
          <button
            onClick={(e) => { e.stopPropagation(); fetchBriefing(); }}
            disabled={loading}
            style={{ background: 'transparent', border: '1px solid #2a2d3e', color: '#64748b', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            ↻
          </button>
          <span style={{ color: '#475569', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && result && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid #2a2d3e' }}>
          <div style={{ paddingTop: 12 }}>
            {renderContent(result.content)}
          </div>
        </div>
      )}
    </div>
  );
}
