import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import { useSignals } from '../../src/hooks/useSignals';
import { useHumanState } from '../../src/hooks/useHumanState';
import { useAdvisor } from '../../src/hooks/useAdvisor';
import type { AdvisorSuggestion } from '../../src/lib/api';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'system';
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩'];
const URGENCY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const URGENCY_LABEL = { high: 'Urgente', medium: 'Pronto', low: 'Cuando puedas' };

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }
function initials(name: string)    { return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }

// ─── State widget ────────────────────────────────────────────────────────────

function StateWidget() {
  const { todayState, loading } = useHumanState();
  if (loading) return null;

  if (!todayState) {
    return (
      <TouchableOpacity style={styles.widgetPrompt} onPress={() => router.push('/(tabs)/state')}>
        <Text style={styles.widgetPromptText}>¿Cómo te sientes hoy?</Text>
        <Text style={styles.widgetPromptArrow}>→</Text>
      </TouchableOpacity>
    );
  }

  const color = scoreColor(todayState.composite_score);
  const emoji = MOOD_EMOJI[todayState.mood_score - 1] ?? '🙂';

  return (
    <TouchableOpacity style={styles.widgetCard} onPress={() => router.push('/(tabs)/state')}>
      <View style={[styles.widgetScore, { borderColor: color }]}>
        <Text style={[styles.widgetScoreNum, { color }]}>{todayState.composite_score}</Text>
      </View>
      <View style={styles.widgetInfo}>
        <Text style={styles.widgetLabel}>Tu estado hoy</Text>
        <Text style={styles.widgetDetail}>
          {emoji} · Energía {todayState.energy_score}/10
          {todayState.emotional_tags.length > 0 ? ` · ${todayState.emotional_tags[0]}` : ''}
        </Text>
      </View>
      <View style={[styles.widgetRiskDot, { backgroundColor: scoreColor(100 - todayState.interaction_risk) }]} />
    </TouchableOpacity>
  );
}

// ─── Advisor suggestion card ─────────────────────────────────────────────────

function SuggestionCard({ s }: { s: AdvisorSuggestion }) {
  const urgColor = URGENCY_COLOR[s.urgency];
  return (
    <TouchableOpacity
      style={styles.suggCard}
      onPress={() => router.push(`/person/${s.person_id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.suggTop}>
        <View style={[styles.suggAvatar, { backgroundColor: avatarColor(s.person_name) }]}>
          <Text style={styles.suggAvatarText}>{initials(s.person_name)}</Text>
        </View>
        <View style={[styles.suggBadge, { backgroundColor: urgColor + '22', borderColor: urgColor }]}>
          <Text style={[styles.suggBadgeText, { color: urgColor }]}>{URGENCY_LABEL[s.urgency]}</Text>
        </View>
      </View>
      <Text style={styles.suggName} numberOfLines={1}>{s.person_name}</Text>
      {s.person_org ? <Text style={styles.suggOrg} numberOfLines={1}>{s.person_org}</Text> : null}
      <Text style={styles.suggReason} numberOfLines={2}>{s.reason}</Text>
      <View style={styles.suggScoreRow}>
        <Text style={[styles.suggScore, { color: scoreColor(s.relationship_score) }]}>
          {s.relationship_score}
        </Text>
        <Text style={styles.suggScoreLabel}> rel</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Advisor section ─────────────────────────────────────────────────────────

function AdvisorSection() {
  const { data, loading } = useAdvisor();

  if (loading || !data || data.suggestions.length === 0) return null;

  return (
    <View style={styles.advisorSection}>
      <View style={styles.advisorHeader}>
        <Text style={styles.advisorTitle}>Sugerencias de contacto</Text>
        {!data.user_available && (
          <Text style={styles.advisorWarning}>⚠ Tu estado sugiere cautela</Text>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advisorScroll}>
        {data.suggestions.slice(0, 6).map(s => (
          <SuggestionCard key={s.person_id} s={s} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Conversation header (sticky above messages list) ────────────────────────

function ConversationHeader() {
  return (
    <View>
      <StateWidget />
      <AdvisorSection />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ConversationScreen() {
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<FlatList>(null);
  const { send, loading, error } = useSignals();

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg: Message = { id: Date.now().toString(), text, role: 'user' };
    setMessages((m) => [...m, userMsg]);

    const result = await send('interaction', { message: text });

    const sysMsg: Message = {
      id:   `${Date.now()}-sys`,
      role: 'system',
      text: result ? result.response : 'Error al procesar.',
    };
    setMessages((m) => [...m, sysMsg]);
    setTimeout(() => listRef.current?.scrollToEnd(), 100);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ConversationHeader />}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.sysBubble]}>
            <Text style={item.role === 'user' ? styles.userText : styles.sysText}>{item.text}</Text>
          </View>
        )}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe algo..."
          placeholderTextColor="#9ca3af"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={loading || !input.trim()}
        >
          <Text style={styles.sendBtnText}>{loading ? '...' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },

  // State widget
  widgetPrompt: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
  },
  widgetPromptText:  { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  widgetPromptArrow: { fontSize: 16, color: '#6366f1' },
  widgetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 12, marginBottom: 4, padding: 14, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  widgetScore:    { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  widgetScoreNum: { fontSize: 16, fontWeight: '800' },
  widgetInfo:     { flex: 1 },
  widgetLabel:    { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  widgetDetail:   { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 1 },
  widgetRiskDot:  { width: 10, height: 10, borderRadius: 5 },

  // Advisor section
  advisorSection: { marginTop: 4, marginBottom: 4 },
  advisorHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  advisorTitle:   { fontSize: 13, fontWeight: '700', color: '#374151' },
  advisorWarning: { fontSize: 11, color: '#f59e0b' },
  advisorScroll:  { paddingHorizontal: 12, gap: 10 },

  // Suggestion card
  suggCard: {
    width: 148, padding: 12, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e5e7eb', gap: 4,
  },
  suggTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  suggAvatar:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  suggAvatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  suggBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  suggBadgeText:  { fontSize: 9, fontWeight: '700' },
  suggName:       { fontSize: 13, fontWeight: '700', color: '#111827' },
  suggOrg:        { fontSize: 11, color: '#9ca3af' },
  suggReason:     { fontSize: 11, color: '#6b7280', lineHeight: 15, marginTop: 2 },
  suggScoreRow:   { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  suggScore:      { fontSize: 18, fontWeight: '800' },
  suggScoreLabel: { fontSize: 11, color: '#9ca3af' },

  // Conversation
  list:           { padding: 12, gap: 8, paddingBottom: 16 },
  bubble:         { maxWidth: '80%', borderRadius: 12, padding: 12 },
  userBubble:     { alignSelf: 'flex-end', backgroundColor: '#6366f1' },
  sysBubble:      { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  userText:       { color: '#fff', fontSize: 15 },
  sysText:        { color: '#374151', fontSize: 13 },
  error:          { color: '#ef4444', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
  inputRow:       { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input:          { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn:        { backgroundColor: '#6366f1', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText:    { color: '#fff', fontWeight: '600' },
});
