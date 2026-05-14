import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface BriefingResult {
  content: string;
  tokens: number;
  costUsd: number;
}

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

interface Props {
  onUpgrade?: () => void;
}

export default function ExecutiveBriefing({ onUpgrade }: Props) {
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/briefing/executive`, { credentials: 'include' });
      if (res.status === 403) {
        setError('pro_required');
        return;
      }
      if (!res.ok) throw new Error('Error al cargar');
      const data = await res.json() as BriefingResult;
      setResult(data);
    } catch {
      setError('No se pudo cargar el briefing. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
        <Text style={styles.loadingTxt}>Generando briefing ejecutivo…</Text>
      </View>
    );
  }

  if (error === 'pro_required') {
    return (
      <View style={styles.center}>
        <Text style={styles.proLock}>◈</Text>
        <Text style={styles.proTitle}>Función PRO</Text>
        <Text style={styles.proSubtitle}>El briefing ejecutivo requiere SIR Pro</Text>
        {onUpgrade && (
          <Pressable onPress={onUpgrade} style={styles.upgradeBtn}>
            <Text style={styles.upgradeTxt}>Ver planes →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTxt}>{error}</Text>
        <Pressable onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!result) return null;

  const lines = result.content.split('\n');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Briefing Ejecutivo</Text>
        <Text style={styles.subtitle}>Vista semanal</Text>
      </View>

      <View style={styles.card}>
        {lines.map((line, i) => {
          if (line.startsWith('## ')) {
            return <Text key={i} style={styles.sectionHeader}>{line.replace('## ', '')}</Text>;
          }
          if (line.startsWith('• ') || line.match(/^\d+\. /)) {
            return <Text key={i} style={styles.bullet}>{line}</Text>;
          }
          if (line.trim() === '') return null;
          return <Text key={i} style={styles.bodyTxt}>{line}</Text>;
        })}
      </View>

      {result.tokens > 0 && (
        <Text style={styles.meta}>{result.tokens} tokens · ${result.costUsd.toFixed(4)}</Text>
      )}

      <Pressable onPress={load} style={styles.refreshBtn}>
        <Text style={styles.refreshTxt}>↻ Actualizar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { padding: 20, paddingBottom: 40 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  header:        { marginBottom: 20 },
  title:         { fontSize: 26, fontWeight: '800', color: '#e2e8f0' },
  subtitle:      { fontSize: 14, color: '#64748b', marginTop: 2 },
  card:          { backgroundColor: '#1a1d27', borderRadius: 14, padding: 18, marginBottom: 16 },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: '#818cf8', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  bullet:        { fontSize: 14, color: '#e2e8f0', lineHeight: 22, marginBottom: 4 },
  bodyTxt:       { fontSize: 13, color: '#94a3b8', lineHeight: 20 },
  meta:          { fontSize: 11, color: '#475569', textAlign: 'center' },
  loadingTxt:    { marginTop: 12, color: '#64748b', fontSize: 14 },
  errorTxt:      { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn:      { marginTop: 10, padding: 10 },
  retryTxt:      { color: '#6366f1', fontSize: 14 },
  refreshBtn:    { marginTop: 16, padding: 12, alignItems: 'center' },
  refreshTxt:    { color: '#6366f1', fontSize: 13 },
  proLock:       { fontSize: 40, color: '#475569', marginBottom: 8 },
  proTitle:      { fontSize: 20, fontWeight: '700', color: '#e2e8f0' },
  proSubtitle:   { fontSize: 14, color: '#64748b', textAlign: 'center' },
  upgradeBtn:    { marginTop: 16, backgroundColor: '#6366f1', borderRadius: 10, padding: 12, paddingHorizontal: 24 },
  upgradeTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
});
