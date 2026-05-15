'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updatePersonStage } from './actions';
import type { PipelineCard } from './page';

const STAGES = [
  { key: 'prospect',  label: 'Prospecto',   color: '#93c5fd', bg: '#93c5fd18' },
  { key: 'active',    label: 'Activo',      color: '#86efac', bg: '#86efac18' },
  { key: 'strategic', label: 'Estratégico', color: '#fcd34d', bg: '#fcd34d18' },
  { key: 'dormant',   label: 'Inactivo',    color: '#d1d5db', bg: '#d1d5db12' },
];

const REL_TYPES = [
  { value: '',             label: 'Todos' },
  { value: 'strategic',   label: '🎯 Estratégico' },
  { value: 'professional',label: '👔 Profesional' },
  { value: 'personal',    label: '❤️ Personal' },
  { value: 'networking',  label: '🤝 Networking' },
  { value: 'developing',  label: '🌱 Por desarrollar' },
];

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }
function initials(n: string) { return n.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }
function scoreColor(v: number) { return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171'; }

export default function PipelineKanban({ initialCards, typeFilter }: { initialCards: PipelineCard[]; typeFilter: string }) {
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [filter, setFilter] = useState(typeFilter);
  const [, startTransition] = useTransition();

  const visible = filter ? cards.filter(c => c.relationshipType === filter) : cards;

  function onDragStart(personId: string) { setDragging(personId); }
  function onDragEnd() { setDragging(null); setDragOver(null); }
  function onDragOver(e: React.DragEvent, stage: string) { e.preventDefault(); setDragOver(stage); }

  function onDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault();
    if (!dragging || dragging === null) return;
    const card = cards.find(c => c.personId === dragging);
    if (!card || card.stage === targetStage) { setDragging(null); setDragOver(null); return; }

    setCards(prev => prev.map(c => c.personId === dragging ? { ...c, stage: targetStage } : c));
    setDragging(null);
    setDragOver(null);

    const draggedId = dragging;
    const prevStage = card.stage;
    startTransition(() => {
      updatePersonStage(draggedId, targetStage).catch(() => {
        setCards(prev => prev.map(c => c.personId === draggedId ? { ...c, stage: prevStage } : c));
      });
    });
  }

  return (
    <div>
      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {REL_TYPES.map(t => {
          const active = filter === t.value;
          return (
            <button key={t.value} onClick={() => setFilter(t.value)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
              background: active ? '#818cf833' : '#1a1d27',
              border: `1px solid ${active ? '#818cf8' : '#2a2d3e'}`,
              color: active ? '#818cf8' : '#64748b',
            }}>{t.label}</button>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
        {STAGES.map(stage => {
          const stageCards = visible.filter(c => c.stage === stage.key);
          const isOver = dragOver === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={e => onDragOver(e, stage.key)}
              onDrop={e => onDrop(e, stage.key)}
              onDragLeave={() => setDragOver(null)}
              style={{
                background: isOver ? stage.bg : '#12141f',
                border: `1px solid ${isOver ? stage.color : '#2a2d3e'}`,
                borderRadius: 12,
                padding: '12px 10px',
                minHeight: 120,
                transition: 'all 0.15s',
              }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, background: '#2a2d3e', color: '#64748b', borderRadius: 10, padding: '1px 6px' }}>{stageCards.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageCards.map(card => (
                  <div
                    key={card.personId}
                    draggable
                    onDragStart={() => onDragStart(card.personId)}
                    onDragEnd={onDragEnd}
                    style={{
                      background: '#1a1d27',
                      border: `1px solid ${dragging === card.personId ? stage.color : '#2a2d3e'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'grab',
                      opacity: dragging === card.personId ? 0.5 : 1,
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(card.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {initials(card.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</p>
                        {(card.role || card.organization) && (
                          <p style={{ margin: 0, fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[card.role, card.organization].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {card.daysSinceContact !== null && (
                        <span style={{ fontSize: 10, color: card.daysSinceContact > 30 ? '#f87171' : '#64748b' }}>
                          {card.daysSinceContact}d sin contacto
                        </span>
                      )}
                      {card.opportunityScore !== null && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: scoreColor(card.opportunityScore) }}>
                          {card.opportunityScore}
                        </span>
                      )}
                    </div>
                    <Link href={`/red/${card.slug ?? card.personId}`} onClick={e => e.stopPropagation()} style={{ display: 'block', marginTop: 6, fontSize: 10, color: '#475569', textDecoration: 'none', textAlign: 'right' as const }}>
                      Ver perfil →
                    </Link>
                  </div>
                ))}
                {stageCards.length === 0 && (
                  <div style={{ padding: '16px 8px', textAlign: 'center' as const, border: '1px dashed #2a2d3e', borderRadius: 8 }}>
                    <p style={{ color: '#334155', fontSize: 11, margin: 0 }}>Arrastra aquí</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
