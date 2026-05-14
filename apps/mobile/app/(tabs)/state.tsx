import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { saveHumanState, type HumanStateLog } from '../../src/lib/api';

const MOODS = ['😔', '😐', '🙂', '😊', '🤩'] as const;
const PHYSICAL_TAGS = ['descansado', 'activo', 'cansado', 'enfermo'] as const;
const EMOTIONAL_TAGS = ['tranquilo', 'motivado', 'feliz', 'ansioso', 'estresado'] as const;

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={[styles.scoreCard, { borderLeftColor: scoreColor(value) }]}>
      <Text style={[styles.scoreValue, { color: scoreColor(value) }]}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

export default function StateScreen() {
  const [mood, setMood]         = useState<number | null>(null);   // 1-5
  const [energy, setEnergy]     = useState<number | null>(null);   // 1-10
  const [physical, setPhysical] = useState<string[]>([]);
  const [emotional, setEmotional] = useState<string[]>([]);
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<HumanStateLog | null>(null);

  function toggleTag(tag: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  }

  async function handleSave() {
    if (!mood || !energy) {
      setError('Selecciona tu ánimo y nivel de energía.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const log = await saveHumanState({
        mood_score: mood,
        energy_score: energy,
        physical_tags: physical,
        emotional_tags: emotional,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setMood(null);
    setEnergy(null);
    setPhysical([]);
    setEmotional([]);
    setNotes('');
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Estado registrado ✓</Text>
        <Text style={styles.subtitle}>
          {MOODS[result.mood_score - 1]} · Energía {result.energy_score}/10
        </Text>

        <View style={styles.scoresRow}>
          <ScoreCard label="Score general"   value={result.composite_score} />
          <ScoreCard label="Disponibilidad"  value={result.availability_score} />
          <ScoreCard label="Riesgo interacción" value={result.interaction_risk} />
        </View>

        {result.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.sectionLabel}>Notas</Text>
            <Text style={styles.notesText}>{result.notes}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
          <Text style={styles.secondaryBtnText}>Registrar otro estado</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>¿Cómo te sientes hoy?</Text>

      {/* Mood */}
      <Text style={styles.sectionLabel}>Estado de ánimo</Text>
      <View style={styles.moodRow}>
        {MOODS.map((emoji, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.moodBtn, mood === i + 1 && styles.moodBtnSelected]}
            onPress={() => setMood(i + 1)}
          >
            <Text style={styles.moodEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Energy */}
      <Text style={styles.sectionLabel}>Nivel de energía</Text>
      <View style={styles.energyRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.energyBtn, energy === n && styles.energyBtnSelected]}
            onPress={() => setEnergy(n)}
          >
            <Text style={[styles.energyNum, energy === n && styles.energyNumSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Physical tags */}
      <Text style={styles.sectionLabel}>Estado físico</Text>
      <View style={styles.tagRow}>
        {PHYSICAL_TAGS.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[styles.tag, physical.includes(tag) && styles.tagSelected]}
            onPress={() => toggleTag(tag, physical, setPhysical)}
          >
            <Text style={[styles.tagText, physical.includes(tag) && styles.tagTextSelected]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Emotional tags */}
      <Text style={styles.sectionLabel}>Estado emocional</Text>
      <View style={styles.tagRow}>
        {EMOTIONAL_TAGS.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[styles.tag, emotional.includes(tag) && styles.tagSelected]}
            onPress={() => toggleTag(tag, emotional, setEmotional)}
          >
            <Text style={[styles.tagText, emotional.includes(tag) && styles.tagTextSelected]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notes */}
      <Text style={styles.sectionLabel}>Notas (opcional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="¿Algo más que quieras registrar?"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.saveBtn, (!mood || !energy || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!mood || !energy || saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Guardar estado</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9fafb' },
  content:    { padding: 20, gap: 12, paddingBottom: 40 },
  title:      { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle:   { fontSize: 16, color: '#6b7280', marginBottom: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 4 },

  moodRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  moodBtnSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  moodEmoji:  { fontSize: 26 },

  energyRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  energyBtn:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  energyBtnSelected: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
  energyNum:  { fontSize: 12, fontWeight: '600', color: '#374151' },
  energyNumSelected: { color: '#fff' },

  tagRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff' },
  tagSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  tagText:    { fontSize: 14, color: '#374151' },
  tagTextSelected: { color: '#6366f1', fontWeight: '600' },

  notesInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top', minHeight: 80 },
  notesCard:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  notesText:  { fontSize: 14, color: '#374151', marginTop: 4 },

  errorText:  { color: '#ef4444', fontSize: 13 },

  saveBtn:    { backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryBtn: { borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: '#6366f1', fontSize: 15, fontWeight: '600' },

  scoresRow:  { flexDirection: 'row', gap: 10, marginTop: 8 },
  scoreCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreLabel: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center' },
});
