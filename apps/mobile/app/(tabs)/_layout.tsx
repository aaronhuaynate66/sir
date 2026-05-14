import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#6366f1' }}>
      <Tabs.Screen name="index"    options={{ title: 'Conversación' }} />
      <Tabs.Screen name="state"    options={{ title: 'Estado' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memorias' }} />
    </Tabs>
  );
}
