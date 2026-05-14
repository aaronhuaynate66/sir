import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { usePeople } from '../../src/hooks/usePeople';
import { createPerson } from '../../src/lib/api';

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1';
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

export default function PeopleScreen() {
  const { allPeople, loading, error, refresh } = usePeople();
  const [query,  setQuery]  = useState('');
  const [adding, setAdding] = useState(false);

  // Add person modal state
  const [newName, setNewName] = useState('');
  const [newOrg,  setNewOrg]  = useState('');
  const [newRole, setNewRole] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allPeople;
    return allPeople.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.organization?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [allPeople, query]);

  function openAdd() {
    setNewName(''); setNewOrg(''); setNewRole(''); setNewEmail('');
    setSaveErr(null);
    setAdding(true);
  }

  async function handleSave() {
    if (!newName.trim()) { setSaveErr('El nombre es obligatorio.'); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      await createPerson({
        name:         newName.trim(),
        ...(newOrg.trim()   ? { organization: newOrg.trim() }   : {}),
        ...(newRole.trim()  ? { role:         newRole.trim() }  : {}),
        ...(newEmail.trim() ? { email:        newEmail.trim() } : {}),
      });
      setAdding(false);
      refresh();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar personas..."
          placeholderTextColor="#9ca3af"
          clearButtonMode="while-editing"
        />
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#6366f1" />}
      {error   && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Sin contactos</Text>
              <Text style={styles.emptyHint}>Toca + para agregar a alguien</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/person/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, { backgroundColor: avatarColor(item.name) }]}>
              <Text style={styles.avatarText}>{initials(item.name)}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.name}</Text>
              {(item.role || item.organization) ? (
                <Text style={styles.cardSub} numberOfLines={1}>
                  {[item.role, item.organization].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {item.email ? (
                <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add person modal */}
      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAdding(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva persona</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? '...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput style={styles.field} value={newName} onChangeText={setNewName} placeholder="Nombre completo" placeholderTextColor="#9ca3af" />

            <Text style={styles.fieldLabel}>Organización</Text>
            <TextInput style={styles.field} value={newOrg} onChangeText={setNewOrg} placeholder="Empresa o proyecto" placeholderTextColor="#9ca3af" />

            <Text style={styles.fieldLabel}>Rol</Text>
            <TextInput style={styles.field} value={newRole} onChangeText={setNewRole} placeholder="CEO, Desarrollador…" placeholderTextColor="#9ca3af" />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.field} value={newEmail} onChangeText={setNewEmail} placeholder="correo@ejemplo.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />

            {saveErr ? <Text style={styles.errorText}>{saveErr}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9fafb' },

  searchRow:  { padding: 12, paddingBottom: 4 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },

  loader:     { marginTop: 32 },
  errorText:  { color: '#ef4444', fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },

  list:       { padding: 12, gap: 8, paddingBottom: 80 },
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint:  { fontSize: 13, color: '#9ca3af', marginTop: 4 },

  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  avatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardInfo:   { flex: 1 },
  cardName:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub:    { fontSize: 12, color: '#6b7280', marginTop: 1 },
  cardEmail:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  chevron:    { fontSize: 20, color: '#d1d5db', fontWeight: '300' },

  fab:        { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText:    { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalCancel:    { fontSize: 15, color: '#6b7280' },
  modalSave:      { fontSize: 15, fontWeight: '600', color: '#6366f1' },
  modalSaveDisabled: { opacity: 0.45 },

  modalBody:  { padding: 20, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 10 },
  field:      { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827' },
});
