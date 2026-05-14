import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import { useSignals } from '../../src/hooks/useSignals';
import { useHumanState } from '../../src/hooks/useHumanState';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'system';
  layers?: string[];
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩'];

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

export default function ConversationScreen() {
  const [input, setInput] = useState('');
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
      id: `${Date.now()}-sys`,
      role: 'system',
      text: result
        ? `Procesado. Capas: ${result.layersActivated.join(', ')}`
        : 'Error al procesar.',
      layers: result?.layersActivated,
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
      <StateWidget />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.sysBubble]}>
            <Text style={item.role === 'user' ? styles.userText : styles.sysText}>
              {item.text}
            </Text>
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

  widgetPrompt: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
  },
  widgetPromptText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  widgetPromptArrow: { fontSize: 16, color: '#6366f1' },

  widgetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  widgetScore: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  widgetScoreNum: { fontSize: 16, fontWeight: '800' },
  widgetInfo:    { flex: 1 },
  widgetLabel:   { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  widgetDetail:  { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 1 },
  widgetRiskDot: { width: 10, height: 10, borderRadius: 5 },

  list:         { padding: 16, gap: 8 },
  bubble:       { maxWidth: '80%', borderRadius: 12, padding: 12 },
  userBubble:   { alignSelf: 'flex-end', backgroundColor: '#6366f1' },
  sysBubble:    { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  userText:     { color: '#fff', fontSize: 15 },
  sysText:      { color: '#374151', fontSize: 13 },
  error:        { color: '#ef4444', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
  inputRow:     { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input:        { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn:      { backgroundColor: '#6366f1', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText:  { color: '#fff', fontWeight: '600' },
});
