'use client';

import { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';
import GraphControls from './GraphControls';
import type { DbPerson, DbRelationship, RelationshipType } from '@sir/db';

interface GraphProps {
  userName: string;
  people: DbPerson[];
  relationships: DbRelationship[];
}

interface PersonNodeData {
  label: string;
  person: DbPerson;
  rel: DbRelationship | null;
}

const TYPE_COLOR: Record<RelationshipType, string> = {
  family:       '#ec4899',
  professional: '#818cf8',
  personal:     '#34d399',
};

const STAGE_COLOR: Record<string, string> = {
  prospect:  '#94a3b8',
  active:    '#34d399',
  strategic: '#818cf8',
  dormant:   '#ef4444',
};

const TYPE_LABEL: Record<RelationshipType, string> = {
  family:       'Familia',
  professional: 'Profesional',
  personal:     'Personal',
};

const STAGE_LABEL: Record<string, string> = {
  prospect:  'Prospecto',
  active:    'Activo',
  strategic: 'Estratégico',
  dormant:   'Dormido',
};

function typeColor(t: RelationshipType | undefined): string {
  return t ? (TYPE_COLOR[t] ?? '#94a3b8') : '#94a3b8';
}

function stageColor(s: string | undefined): string {
  return s ? (STAGE_COLOR[s] ?? '#94a3b8') : '#94a3b8';
}

function buildGraph(
  userName: string,
  people: DbPerson[],
  relationships: DbRelationship[],
  filterType: RelationshipType | 'all',
  minStrength: number,
): { nodes: Node[]; edges: Edge[] } {
  const relMap = new Map<string, DbRelationship>();
  for (const rel of relationships) relMap.set(rel.person_id, rel);

  const visible = people.filter(p => {
    const rel = relMap.get(p.id);
    if (filterType !== 'all' && rel?.relationship_type !== filterType) return false;
    if ((rel?.strength ?? 0) < minStrength) return false;
    return true;
  });

  const centerNode: Node = {
    id: '__user__',
    position: { x: 0, y: 0 },
    data: { label: userName },
    style: {
      background: '#6366f1',
      color: '#fff',
      border: '3px solid #818cf8',
      borderRadius: '50%',
      width: 72,
      height: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 700,
    },
  };

  const R = Math.max(280, visible.length * 45);

  const personNodes: Node<PersonNodeData>[] = visible.map((person, i) => {
    const angle = (i / visible.length) * 2 * Math.PI - Math.PI / 2;
    const rel = relMap.get(person.id) ?? null;
    const color = typeColor(rel?.relationship_type);

    return {
      id: person.id,
      position: {
        x: Math.cos(angle) * R,
        y: Math.sin(angle) * R,
      },
      data: { label: person.name, person, rel },
      style: {
        background: color + '1a',
        border: `2px solid ${color}`,
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 500,
        color: '#e2e8f0',
        minWidth: 90,
        textAlign: 'center',
        cursor: 'pointer',
      },
    };
  });

  const edges: Edge[] = visible
    .filter(p => relMap.has(p.id))
    .map(person => {
      const rel = relMap.get(person.id)!;
      return {
        id: `e-${person.id}`,
        source: '__user__',
        target: person.id,
        style: {
          strokeWidth: Math.max(1, rel.strength / 22),
          stroke: stageColor(rel.stage),
          opacity: 0.7,
        },
        animated: rel.stage === 'strategic',
      };
    });

  return { nodes: [centerNode, ...personNodes], edges };
}

export default function RelationshipGraph({ userName, people, relationships }: GraphProps) {
  const [filterType, setFilterType] = useState<RelationshipType | 'all'>('all');
  const [minStrength, setMinStrength] = useState(0);
  const [selected, setSelected] = useState<PersonNodeData | null>(null);

  const { nodes, edges } = useMemo(
    () => buildGraph(userName, people, relationships, filterType, minStrength),
    [userName, people, relationships, filterType, minStrength],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (node.id === '__user__') { setSelected(null); return; }
    setSelected(node.data as PersonNodeData);
  }, []);

  const onPaneClick = useCallback(() => setSelected(null), []);

  return (
    <div style={{ position: 'relative', height: '75vh', borderRadius: 12, overflow: 'hidden', background: '#12141f', border: '1px solid #2a2d3e' }}>
      <GraphControls
        filterType={filterType}
        minStrength={minStrength}
        onFilterType={setFilterType}
        onMinStrength={setMinStrength}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#12141f' }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#2a2d3e" gap={24} size={1} />
        <Controls style={{ background: '#1a1d27', border: '1px solid #2a2d3e' }} />
      </ReactFlow>

      {selected && (
        <SidePanel data={selected} onClose={() => setSelected(null)} />
      )}

      {people.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 32 }}>◎</span>
          <p style={{ color: '#475569', fontSize: 15, margin: 0 }}>Agrega personas para ver tu grafo de relaciones</p>
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>Ve a Personas → Agregar contacto</p>
        </div>
      )}
    </div>
  );
}

function SidePanel({ data, onClose }: { data: PersonNodeData; onClose: () => void }) {
  const { person, rel } = data;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, height: '100%', width: 272,
      background: '#1a1d27', borderLeft: '1px solid #2a2d3e',
      padding: '20px 18px', overflowY: 'auto', zIndex: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
          {person.name}
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0, marginLeft: 8 }}
        >
          ×
        </button>
      </div>

      {(person.organization ?? person.role) && (
        <p style={{ margin: '0 0 3px', color: '#94a3b8', fontSize: 13 }}>
          {[person.role, person.organization].filter(Boolean).join(' · ')}
        </p>
      )}
      {person.email && (
        <p style={{ margin: '0 0 18px', color: '#475569', fontSize: 12 }}>{person.email}</p>
      )}

      {rel ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <TypeBadge color={typeColor(rel.relationship_type)} label={TYPE_LABEL[rel.relationship_type] ?? rel.relationship_type} />
            <TypeBadge color={stageColor(rel.stage)} label={STAGE_LABEL[rel.stage] ?? rel.stage} />
          </div>
          <Metric label="Fuerza de vínculo" value={rel.strength} max={100} />
          <Metric label="Reciprocidad" value={rel.reciprocity} max={100} />
          <Metric label="Confianza" value={Math.round(rel.trust_score * 100)} max={100} />
          {rel.last_contact_at && (
            <p style={{ fontSize: 11, color: '#475569', margin: '12px 0 0' }}>
              Último contacto: {new Date(rel.last_contact_at).toLocaleDateString('es-PE')}
            </p>
          )}
        </div>
      ) : (
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Sin relación registrada aún.</p>
      )}

      {person.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {person.tags.map(tag => (
            <span key={tag} style={{ fontSize: 11, background: '#2a2d3e', color: '#94a3b8', borderRadius: 6, padding: '2px 8px' }}>
              {tag}
            </span>
          ))}
        </div>
      )}

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
    </div>
  );
}

function TypeBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      background: color + '1a', border: `1px solid ${color}`,
      borderRadius: 6, padding: '2px 9px', fontSize: 11, color: '#e2e8f0', fontWeight: 500,
    }}>
      {label}
    </span>
  );
}

function Metric({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: '#2a2d3e', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
