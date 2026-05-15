'use client';
import { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';
import type { StakeholderPerson } from './page';

const TYPE_CONFIG = {
  strategic:   { color: '#a855f7', size: 60 },
  professional:{ color: '#3b82f6', size: 46 },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? { color: '#94a3b8', size: 40 };
}

function initials(n: string) { return n.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }
function scoreColor(v: number) { return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171'; }
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }

function StakeholderNode({ data }: NodeProps<{ person: StakeholderPerson; onClick: (p: StakeholderPerson) => void }>) {
  const { person, onClick } = data;
  const cfg = getConfig(person.relationship_type);
  const ini = initials(person.name);
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div
        onClick={() => onClick(person)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
      >
        <div style={{
          width: cfg.size, height: cfg.size, borderRadius: '50%',
          background: cfg.color + '22',
          border: `2px solid ${cfg.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, fontWeight: 700, fontSize: cfg.size > 50 ? 16 : 12,
          boxShadow: person.relationship_type === 'strategic' ? `0 0 18px ${cfg.color}44` : 'none',
        }}>
          {ini}
        </div>
        <span style={{ fontSize: 10, color: '#94a3b8', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' as const }}>
          {person.name.split(' ')[0]}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </>
  );
}

const nodeTypes = { stakeholder: StakeholderNode };

function buildGraph(stakeholders: StakeholderPerson[], onClickNode: (p: StakeholderPerson) => void): { nodes: Node[]; edges: Edge[] } {
  const center: Node = {
    id: '__you__', type: 'default',
    position: { x: 0, y: 0 },
    data: { label: 'TÚ' },
    style: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: '3px solid #818cf8', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    selectable: false, draggable: false,
  };

  const R = Math.max(250, stakeholders.length * 48);
  const personNodes: Node[] = stakeholders.map((p, i) => ({
    id: p.id, type: 'stakeholder',
    position: {
      x: Math.cos((i / stakeholders.length) * 2 * Math.PI - Math.PI / 2) * R,
      y: Math.sin((i / stakeholders.length) * 2 * Math.PI - Math.PI / 2) * R,
    },
    data: { person: p, onClick: onClickNode },
    style: { overflow: 'visible', background: 'transparent', border: 'none', padding: 0, width: 80 },
  }));

  const edges: Edge[] = stakeholders.map(p => ({
    id: `e-${p.id}`, source: '__you__', target: p.id,
    style: { strokeWidth: Math.max(1.5, p.strength / 25), stroke: getConfig(p.relationship_type).color, opacity: 0.5 },
    animated: p.relationship_type === 'strategic',
  }));

  return { nodes: [center, ...personNodes], edges };
}

export default function StakeholderGraph({ stakeholders, ranked }: { stakeholders: StakeholderPerson[]; ranked: StakeholderPerson[] }) {
  const [selected, setSelected] = useState<StakeholderPerson | null>(null);
  const onClickNode = useCallback((p: StakeholderPerson) => setSelected(p), []);

  const { nodes, edges } = useMemo(() => buildGraph(stakeholders, onClickNode), [stakeholders, onClickNode]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_e, node) => {
    const p = stakeholders.find(s => s.id === node.id);
    if (p) setSelected(p);
  }, [stakeholders]);

  if (stakeholders.length === 0) {
    return (
      <div style={{ background: '#1a1d27', border: '1px dashed #2a2d3e', borderRadius: 14, padding: 48, textAlign: 'center' as const }}>
        <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>No hay contactos profesionales o estratégicos registrados.</p>
        <Link href="/red" style={{ color: '#818cf8', fontSize: 13, textDecoration: 'none' }}>Ir a la red →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
      {/* Graph */}
      <div style={{ height: '68vh', borderRadius: 14, overflow: 'hidden', background: '#0d0f1a', border: '1px solid #2a2d3e', position: 'relative' }}>
        {/* Legend */}
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 11, background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>● Estratégico</span>
          <span style={{ fontSize: 11, background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>● Profesional</span>
        </div>
        <ReactFlow
          nodes={nodes} edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={() => setSelected(null)}
          fitView fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0d0f1a' }}
          nodesConnectable={false}
        >
          <Background color="#1e2130" gap={28} size={1} />
          <Controls style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8 }} showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Right panel: ranking or selected person */}
      <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 14, padding: '16px 14px', overflowY: 'auto', maxHeight: '68vh' }}>
        {selected ? (
          <SelectedPanel person={selected} onClose={() => setSelected(null)} />
        ) : (
          <RankingPanel ranked={ranked} onSelect={setSelected} />
        )}
      </div>
    </div>
  );
}

function RankingPanel({ ranked, onSelect }: { ranked: StakeholderPerson[]; onSelect: (p: StakeholderPerson) => void }) {
  return (
    <>
      <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Ranking por importancia
      </p>
      {ranked.map((p, i) => {
        const cfg = getConfig(p.relationship_type);
        return (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: '#12141f', border: '1px solid #2a2d3e' }}
          >
            <span style={{ fontSize: 10, color: '#334155', width: 14 }}>#{i + 1}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{initials(p.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
              <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color }}>{p.relationship_type}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(p.strength), flexShrink: 0 }}>{p.strength}</span>
          </div>
        );
      })}
    </>
  );
}

function SelectedPanel({ person: p, onClose }: { person: StakeholderPerson; onClose: () => void }) {
  const cfg = getConfig(p.relationship_type);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{p.name}</h3>
          <span style={{ fontSize: 10, fontWeight: 700, background: cfg.color + '22', color: cfg.color, borderRadius: 4, padding: '2px 7px' }}>{p.relationship_type}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      {(p.organization ?? p.role) && <p style={{ margin: '0 0 4px', color: '#94a3b8', fontSize: 12 }}>{[p.role, p.organization].filter(Boolean).join(' · ')}</p>}
      {p.email && <p style={{ margin: '0 0 12px', color: '#475569', fontSize: 11 }}>{p.email}</p>}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Fuerza</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(p.strength) }}>{p.strength}</span>
        </div>
        <div style={{ background: '#2a2d3e', borderRadius: 3, height: 5 }}><div style={{ width: `${p.strength}%`, height: '100%', background: scoreColor(p.strength), borderRadius: 3 }} /></div>
      </div>
      {p.lastContact && <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px' }}>Último contacto: {new Date(p.lastContact).toLocaleDateString('es-PE')}</p>}
      {p.lastBriefing && <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px' }}>Último briefing: {new Date(p.lastBriefing).toLocaleDateString('es-PE')}</p>}
      {p.opportunityScore !== null && (
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 14px' }}>
          Oportunidad activa: <span style={{ fontWeight: 700, color: scoreColor(p.opportunityScore) }}>{p.opportunityScore}</span>
        </p>
      )}
      <Link href={`/red/${p.slug ?? p.id}`} style={{ display: 'block', textAlign: 'center' as const, padding: '8px', background: '#6366f1', borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
        Ver perfil completo →
      </Link>
    </>
  );
}
