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
import BriefingButton from '@/components/BriefingButton';
import GraphControls from './GraphControls';
import type { DbPerson, DbRelationship } from '@sir/db';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphProps {
  userName: string;
  people: DbPerson[];
  relationships: DbRelationship[];
}

interface PersonNodeData {
  person: DbPerson;
  rel:    DbRelationship | null;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const PR_COLOR: Record<string, string> = {
  professional: '#818cf8',
  networking:   '#60a5fa',
  family:       '#ec4899',
  personal:     '#34d399',
  strategic:    '#fbbf24',
  developing:   '#94a3b8',
};

const PR_LABEL: Record<string, string> = {
  professional: 'Profesional',
  networking:   'Red',
  family:       'Familia',
  personal:     'Personal',
  strategic:    'Estratégico',
  developing:   'Desarrollando',
};

function prColor(t: string | undefined): string {
  return PR_COLOR[t ?? ''] ?? '#94a3b8';
}

// ─── Cycle helpers ────────────────────────────────────────────────────────────

function getCycleDay(lastPeriodStart: string): number | null {
  const start = new Date(lastPeriodStart + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const raw = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  if (raw < 1) return null;
  return ((raw - 1) % 28) + 1;
}

function cycleColor(day: number): string {
  if (day <= 5)  return '#E8394D';
  if (day <= 13) return '#4CAF82';
  if (day <= 17) return '#2ECC71';
  return '#7C6FCD';
}

function cycleName(day: number): string {
  if (day <= 5)  return 'Menstrual';
  if (day <= 13) return 'Folicular';
  if (day <= 17) return 'Ovulación';
  return 'Lútea';
}

// ─── Custom: center (user) node ───────────────────────────────────────────────

function UserNode({ data }: NodeProps<{ label: string }>) {
  return (
    <>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <div style={{
        width: 66, height: 66, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        border: '3px solid #818cf8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 18, fontWeight: 800,
        boxShadow: '0 0 24px #6366f140',
      }}>
        {data.label.slice(0, 2).toUpperCase()}
      </div>
    </>
  );
}

// ─── Custom: person node ──────────────────────────────────────────────────────

function PersonNode({ data, selected }: NodeProps<PersonNodeData>) {
  const { person, rel } = data;
  const [hovered, setHovered] = useState(false);

  const initials = person.name.split(' ')
    .slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  const col      = prColor(person.relationship_type);
  const strength = rel?.strength ?? 50;
  const bw       = Math.max(2, Math.round(strength / 22));

  const isPrivate = person.relationship_type === 'personal' || person.relationship_type === 'family';
  const cycleDay  = isPrivate && (person as unknown as { cycle_data?: { last_period_start?: string } }).cycle_data?.last_period_start
    ? getCycleDay((person as unknown as { cycle_data: { last_period_start: string } }).cycle_data.last_period_start)
    : null;

  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ visibility: 'hidden' }} />
      <div
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Avatar circle */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: col + '18',
          border: `${bw}px solid ${selected ? '#fff' : col}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#e2e8f0', fontWeight: 700, fontSize: 16,
          boxShadow: selected ? `0 0 14px ${col}55` : 'none',
          transition: 'all 0.15s',
        }}>
          {initials}
        </div>

        {/* Cycle phase badge */}
        {cycleDay !== null && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: cycleColor(cycleDay),
            border: '2px solid #12141f',
            zIndex: 5,
          }} title={`${cycleName(cycleDay)} · Día ${cycleDay}`} />
        )}

        {/* Name */}
        <span style={{
          fontSize: 11, color: '#94a3b8', maxWidth: 78,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
        }}>
          {person.name.split(' ')[0]}
        </span>

        {/* Hover mini-card */}
        {hovered && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 10px)',
            left: '50%', transform: 'translateX(-50%)',
            background: '#1a1d27',
            border: `1px solid ${col}44`,
            borderRadius: 10, padding: '10px 12px',
            width: 196, zIndex: 9999,
            boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>
              {person.name}
            </p>
            {(person.role || person.organization) && (
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b' }}>
                {[person.role, person.organization].filter(Boolean).join(' · ')}
              </p>
            )}
            {rel?.last_contact_at && (
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569' }}>
                Contacto: {new Date(rel.last_contact_at).toLocaleDateString('es-PE')}
              </p>
            )}
            {cycleDay !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cycleColor(cycleDay), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{cycleName(cycleDay)} · Día {cycleDay}</span>
              </div>
            )}
            <div style={{ marginTop: 7, paddingTop: 6, borderTop: '1px solid #2a2d3e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, background: col + '22', color: col, borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                {PR_LABEL[person.relationship_type] ?? person.relationship_type}
              </span>
              <span style={{ fontSize: 10, color: '#334155' }}>
                Fuerza {strength}
              </span>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </>
  );
}

// IMPORTANT: define nodeTypes outside component to avoid remount on every render
const nodeTypes = { user: UserNode, person: PersonNode };

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(
  userName: string,
  people: DbPerson[],
  relationships: DbRelationship[],
  filterType: string,
  minStrength: number,
): { nodes: Node[]; edges: Edge[] } {
  const relMap = new Map<string, DbRelationship>();
  for (const rel of relationships) relMap.set(rel.person_id, rel);

  const visible = people.filter(p => {
    if (filterType !== 'all' && p.relationship_type !== filterType) return false;
    const s = relMap.get(p.id)?.strength ?? 50;
    return s >= minStrength;
  });

  const center: Node = {
    id: '__user__',
    type: 'user',
    position: { x: 0, y: 0 },
    data: { label: userName },
    selectable: false,
    draggable: false,
  };

  const R = Math.max(300, visible.length * 52);

  const personNodes: Node[] = visible.map((person, i) => {
    const angle = (i / visible.length) * 2 * Math.PI - Math.PI / 2;
    return {
      id:       person.id,
      type:     'person',
      position: { x: Math.cos(angle) * R, y: Math.sin(angle) * R },
      data:     { person, rel: relMap.get(person.id) ?? null } as PersonNodeData,
      style:    { overflow: 'visible', background: 'transparent', border: 'none', padding: 0 },
    };
  });

  const edges: Edge[] = visible.map(person => {
    const rel      = relMap.get(person.id);
    const strength = rel?.strength ?? 50;
    const col      = prColor(person.relationship_type);
    return {
      id:       `e-${person.id}`,
      source:   '__user__',
      target:   person.id,
      style:    { strokeWidth: Math.max(1.5, strength / 22), stroke: col, opacity: 0.55 },
      animated: person.relationship_type === 'strategic',
      label:    PR_LABEL[person.relationship_type],
      labelStyle:   { fontSize: 9, fill: col, fontWeight: 700 },
      labelBgStyle: { fill: '#12141f', fillOpacity: 0.85 },
      labelBgPadding: [4, 3] as [number, number],
    };
  });

  return { nodes: [center, ...personNodes], edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RelationshipGraph({ userName, people, relationships }: GraphProps) {
  const [filterType, setFilterType] = useState('all');
  const [minStrength, setMinStrength] = useState(0);
  const [selected, setSelected] = useState<PersonNodeData | null>(null);

  const { nodes, edges } = useMemo(
    () => buildGraph(userName, people, relationships, filterType, minStrength),
    [userName, people, relationships, filterType, minStrength],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (node.id === '__user__') { setSelected(null); return; }
    const data = node.data as PersonNodeData;
    setSelected(data);
  }, []);

  const onPaneClick = useCallback(() => setSelected(null), []);

  return (
    <div style={{ position: 'relative', height: '78vh', borderRadius: 14, overflow: 'hidden', background: '#0d0f1a', border: '1px solid #2a2d3e' }}>
      <GraphControls
        filterType={filterType}
        minStrength={minStrength}
        onFilterType={setFilterType}
        onMinStrength={setMinStrength}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0d0f1a' }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#1e2130" gap={28} size={1} />
        <Controls
          style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8 }}
          showInteractive={false}
        />
      </ReactFlow>

      {selected && (
        <SidePanel data={selected} onClose={() => setSelected(null)} />
      )}

      {people.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 36, opacity: 0.4 }}>◎</span>
          <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>Agrega personas para ver tu grafo</p>
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>Ve a Personas → Agregar contacto</p>
        </div>
      )}
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function SidePanel({ data, onClose }: { data: PersonNodeData; onClose: () => void }) {
  const { person, rel } = data;
  const col = prColor(person.relationship_type);

  const isPrivate = person.relationship_type === 'personal' || person.relationship_type === 'family';
  const cycleDay  = isPrivate && (person as unknown as { cycle_data?: { last_period_start?: string } }).cycle_data?.last_period_start
    ? getCycleDay((person as unknown as { cycle_data: { last_period_start: string } }).cycle_data.last_period_start)
    : null;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, height: '100%', width: 278,
      background: '#1a1d27', borderLeft: '1px solid #2a2d3e',
      padding: '20px 18px', overflowY: 'auto', zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', color: '#e2e8f0', fontSize: 16, fontWeight: 600 }}>{person.name}</h3>
          <span style={{ fontSize: 10, fontWeight: 700, background: col + '22', color: col, borderRadius: 4, padding: '2px 7px' }}>
            {PR_LABEL[person.relationship_type] ?? person.relationship_type}
          </span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>
          ×
        </button>
      </div>

      {/* Basic info */}
      {(person.organization ?? person.role) && (
        <p style={{ margin: '0 0 4px', color: '#94a3b8', fontSize: 13 }}>
          {[person.role, person.organization].filter(Boolean).join(' · ')}
        </p>
      )}
      {person.email && (
        <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 12 }}>{person.email}</p>
      )}

      {/* Cycle phase */}
      {cycleDay !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          background: cycleColor(cycleDay) + '14', border: `1px solid ${cycleColor(cycleDay)}30`,
          borderRadius: 8, padding: '7px 10px',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: cycleColor(cycleDay), flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#e2e8f0' }}>{cycleName(cycleDay)} · Día {cycleDay} del ciclo</span>
        </div>
      )}

      {/* Relationship metrics */}
      {rel ? (
        <div style={{ marginBottom: 18 }}>
          <Metric label="Fuerza"       value={rel.strength} />
          <Metric label="Reciprocidad" value={rel.reciprocity} />
          <Metric label="Confianza"    value={Math.round(rel.trust_score * 100)} />
          {rel.last_contact_at && (
            <p style={{ fontSize: 11, color: '#475569', margin: '10px 0 0' }}>
              Último contacto: {new Date(rel.last_contact_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      ) : (
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 18 }}>Sin relación registrada.</p>
      )}

      {/* Tags */}
      {person.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
          {person.tags.map(tag => (
            <span key={tag} style={{ fontSize: 10, background: '#2a2d3e', color: '#64748b', borderRadius: 5, padding: '2px 7px' }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          href={`/people/${person.id}`}
          style={{
            display: 'block', textAlign: 'center', padding: '9px',
            background: '#6366f1', borderRadius: 8, color: '#fff',
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}
        >
          Ver perfil completo →
        </Link>
        <BriefingButton personName={person.name} personId={person.id} />
      </div>
    </div>
  );
}

// ─── Metric bar ───────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: number }) {
  const pct    = Math.min(100, Math.max(0, value));
  const barCol = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: '#2a2d3e', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barCol, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
