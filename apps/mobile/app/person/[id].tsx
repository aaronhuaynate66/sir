import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { usePersonDetail } from '../../src/hooks/usePersonDetail';
import { registerInteraction } from '../../src/lib/api';

const QUALITY_EMOJI  = ['💔', '😐', '🙂', '😊', '❤️'];
const QUALITY_LABEL  = ['Mal', 'Regular', 'Bien', 'Genial', 'Excelente'];
const STAGE_COLOR: Record<string, string> = {
  prospect:   '#93c5fd',
  active:     '#86efac',
  strategic:  '#fcd34d',
  dormant:    '#d1d5db',
};
const STAGE_LABEL: Record<string, string> = {
  prospect:  'Prospecto',
  active:    'Activo',
  strategic: 'Estratégico',
  dormant:   'Dormido',
};

function scoreColor(s: number): string {
  if (s >= 70) return '#22c55e';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1';
}
function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { person, relationship, score, loading, refresh } = usePersonDetail(id);

  const [quality,  setQuality]  = useState<number | null>(null);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  async function handleInteraction() {
    if (!quality || !person) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await registerInteraction({
        person_id:   person.id,
        person_name: person.name,
        quality,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setQuality(null);
      setNotes('');
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      refresh();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Persona no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Personas</Text>
      </TouchableOpacity>

      {/* Avatar + name */}
      <View style={styles.heroRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColor(person.name) }]}>
          <Text style={styles.avatarText}>{initials(person.name)}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{person.name}</Text>
          {(person.role || person.organization) ? (
            <Text style={styles.heroSub}>
              {[person.role, person.organization].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {person.email ? <Text style={styles.heroEmail}>{person.email}</Text> : null}
          {person.phone ? <Text style={styles.heroEmail}>{person.phone}</Text> : null}
        </View>
      </View>

      {/* Relationship score */}
      {score && relationship ? (
        <View style={styles.scoreSection}>
          <View style={styles.scoreSectionHeader}>
            <Text style={styles.sectionTitle}>Relación</Text>
            <View style={[styles.stageBadge, { backgroundColor: STAGE_COLOR[relationship.stage] ?? '#e5e7eb' }]}>
              <Text style={styles.stageText}>{STAGE_LABEL[relationship.stage] ?? relationship.stage}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <View style={[styles.scoreCircle, { borderColor: scoreColor(score.overall) }]}>
              <Text style={[styles.scoreNum, { color: scoreColor(score.overall) }]}>{score.overall}</Text>
              <Text style={styles.scoreNumLabel}>Score</Text>
            </View>
            <View style={styles.scoreBars}>
              <ScoreBar label="Fuerza"      value={score.strength}   />
              <ScoreBar label="Reciprocidad" value={score.reciprocity} />
              <ScoreBar label="Confianza"   value={score.trust}      />
            </View>
          </View>

          <Text style={styles.lastContact}>
            Último contacto: {formatDate(relationship.last_contact_at)}
          </Text>
        </View>
      ) : (
        <View style={styles.noRelCard}>
          <Text style={styles.noRelText}>Sin historial de relación aún.</Text>
          <Text style={styles.noRelHint}>Registra una interacción para comenzar.</Text>
        </View>
      )}

      {/* Interaction form */}
      <View style={styles.interactionSection}>
        <Text style={styles.sectionTitle}>Registrar interacción</Text>

        <Text style={styles.fieldLabel}>¿Cómo fue?</Text>
        <View style={styles.qualityRow}>
          {QUALITY_EMOJI.map((emoji, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.qualityBtn, quality === i + 1 && styles.qualityBtnSelected]}
              onPress={() => setQuality(i + 1)}
            >
              <Text style={styles.qualityEmoji}>{emoji}</Text>
              <Text style={[styles.qualityLabel, quality === i + 1 && styles.qualityLabelSelected]}>
                {QUALITY_LABEL[i]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Notas (opcional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="¿De qué hablaron? ¿Qué acordaron?"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />

        {saveErr  ? <Text style={styles.errorText}>{saveErr}</Text>  : null}
        {savedMsg ? <Text style={styles.successText}>✓ Interacción registrada</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!quality || saving) && styles.saveBtnDisabled]}
          onPress={handleInteraction}
          disabled={!quality || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Guardar interacción</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${value}%`, backgroundColor: scoreColor(value) }]} />
      </View>
      <Text style={[barStyles.num, { color: scoreColor(value) }]}>{value}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { fontSize: 12, color: '#6b7280', width: 82 },
  track: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: 6, borderRadius: 3 },
  num:   { fontSize: 12, fontWeight: '700', width: 26, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9fafb' },
  content:    { padding: 20, gap: 16, paddingBottom: 48 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  notFound:   { fontSize: 16, color: '#374151', marginBottom: 16 },

  backRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backArrow:  { fontSize: 26, color: '#6366f1', lineHeight: 28 },
  backLabel:  { fontSize: 16, color: '#6366f1' },
  backBtn:    { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#6366f1', borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '600' },

  heroRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  heroInfo:   { flex: 1 },
  heroName:   { fontSize: 22, fontWeight: '700', color: '#111827' },
  heroSub:    { fontSize: 14, color: '#6b7280', marginTop: 2 },
  heroEmail:  { fontSize: 13, color: '#9ca3af', marginTop: 1 },

  scoreSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  scoreSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  stageBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stageText:    { fontSize: 12, fontWeight: '600', color: '#374151' },

  scoreRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle:  { width: 70, height: 70, borderRadius: 35, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreNum:     { fontSize: 22, fontWeight: '800' },
  scoreNumLabel: { fontSize: 10, color: '#9ca3af', marginTop: -2 },
  scoreBars:    { flex: 1 },
  lastContact:  { fontSize: 12, color: '#9ca3af', marginTop: 12 },

  noRelCard:   { backgroundColor: '#f0f4ff', borderRadius: 14, padding: 16, alignItems: 'center' },
  noRelText:   { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  noRelHint:   { fontSize: 12, color: '#6b7280', marginTop: 4 },

  interactionSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: '#374151' },

  qualityRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  qualityBtn:  { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', flex: 1, marginHorizontal: 2 },
  qualityBtnSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  qualityEmoji: { fontSize: 22 },
  qualityLabel: { fontSize: 10, color: '#6b7280', marginTop: 3 },
  qualityLabelSelected: { color: '#6366f1', fontWeight: '600' },

  notesInput:  { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top', minHeight: 70 },
  errorText:   { color: '#ef4444', fontSize: 13 },
  successText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },

  saveBtn:     { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
