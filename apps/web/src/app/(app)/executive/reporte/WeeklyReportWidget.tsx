'use client';
import { useState } from 'react';

interface ReportData {
  content: string;
  tokens: number;
  costUsd: number;
}

function renderReport(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <p key={i} style={{ fontSize: 14, fontWeight: 700, color: '#818cf8', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.replace('## ', '')}</p>;
    if (line.startsWith('• ') || line.match(/^\d+\. /)) return <p key={i} style={{ fontSize: 13, color: '#e2e8f0', margin: '4px 0', lineHeight: 1.6, paddingLeft: 8 }}>{line}</p>;
    if (line.trim() === '') return null;
    return <p key={i} style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0' }}>{line}</p>;
  });
}

export default function WeeklyReportWidget() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/executive/report', { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      setReport(await res.json() as ReportData);
    } catch {
      setReport({ content: 'No se pudo generar el reporte. Intenta de nuevo.', tokens: 0, costUsd: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? '#2a2d3e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Generando…' : '◈ Generar Reporte con IA'}
        </button>
        {report && (
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 16px', background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
          >
            🖨 Exportar PDF
          </button>
        )}
      </div>
      {report && (
        <div id="report-content" style={{ background: '#1a1d27', border: '1px solid #312e81', borderRadius: 12, padding: '20px 24px' }}>
          {renderReport(report.content)}
          {report.tokens > 0 && (
            <p style={{ marginTop: 16, fontSize: 10, color: '#334155' }}>
              {report.tokens} tokens · ${report.costUsd.toFixed(4)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
