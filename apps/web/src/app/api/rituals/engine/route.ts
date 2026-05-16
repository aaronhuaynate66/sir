import { getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Called by cron or manually. Generates ritual suggestions for ALL users.
export async function POST(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env['CRON_SECRET'] ?? ''}` && authHeader !== `Bearer ${process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  // Get all users with their people and relationships
  const { data: users } = await db.from('users').select('id');
  if (!users) return Response.json({ processed: 0 });

  let totalGenerated = 0;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  for (const { id: userId } of users as Array<{ id: string }>) {
    const [peopleRes, relsRes, signalsRes] = await Promise.all([
      db.from('people').select('id, name, birthday, anniversary, slug').eq('user_id', userId),
      db.from('relationships').select('person_id, strength, last_contact_at, contact_frequency_days').eq('user_id', userId),
      db.from('signals')
        .select('person_id, type, payload, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    type PersonRow = { id: string; name: string; birthday: string | null; anniversary: string | null; slug: string };
    type RelRow    = { person_id: string; strength: number; last_contact_at: string | null; contact_frequency_days: number | null };
    type SigRow    = { person_id: string | null; type: string; payload: Record<string, unknown>; created_at: string };

    const people  = (peopleRes.data  ?? []) as PersonRow[];
    const rels    = (relsRes.data    ?? []) as RelRow[];
    const signals = (signalsRes.data ?? []) as SigRow[];

    const relMap = new Map(rels.map(r => [r.person_id, r]));

    // Suggestions already generated today for this user
    const { data: existingToday } = await db
      .from('ritual_suggestions')
      .select('person_id, type')
      .eq('user_id', userId)
      .gte('created_at', todayStr);

    const existingSet = new Set((existingToday ?? []).map((e: { person_id: string | null; type: string }) => `${e.person_id}_${e.type}`));

    const suggestions: Array<{
      user_id: string; person_id: string; type: string;
      message: string; action_suggestion: string | null; priority: number;
    }> = [];

    function addSuggestion(personId: string, type: string, message: string, action: string | null, priority: number) {
      const key = `${personId}_${type}`;
      if (existingSet.has(key)) return;
      suggestions.push({ user_id: userId, person_id: personId, type, message, action_suggestion: action, priority });
      existingSet.add(key);
    }

    function daysUntilAnnual(dateStr: string): number {
      const d = new Date(dateStr + 'T00:00:00');
      let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      if (next.getTime() < now.getTime() - 86_400_000)
        next = new Date(next.getFullYear() + 1, d.getMonth(), d.getDate());
      return Math.ceil((next.getTime() - now.getTime()) / 86_400_000);
    }

    for (const person of people) {
      const rel = relMap.get(person.id);

      // 1. No contact in 21+ days
      if (rel?.last_contact_at) {
        const daysWithout = Math.floor((now.getTime() - new Date(rel.last_contact_at).getTime()) / 86_400_000);
        if (daysWithout >= 21 && (rel.strength ?? 0) > 20) {
          const weeks = Math.floor(daysWithout / 7);
          addSuggestion(person.id, 'no_contact',
            `Han pasado ${weeks === 3 ? '3 semanas' : `${daysWithout} días`} sin contactar a ${person.name}`,
            `Escríbele o llámale para retomar el contacto`,
            daysWithout >= 60 ? 9 : daysWithout >= 45 ? 8 : 7
          );
        }
      }

      // 2. Birthday in 7 days
      if (person.birthday) {
        const days = daysUntilAnnual(person.birthday);
        if (days <= 7 && days >= 0) {
          addSuggestion(person.id, 'birthday',
            days === 0
              ? `¡Hoy es el cumpleaños de ${person.name}!`
              : `El cumpleaños de ${person.name} es en ${days} día${days !== 1 ? 's' : ''}`,
            days === 0 ? 'Felicítale hoy' : 'Prepara un mensaje personalizado',
            days === 0 ? 10 : days <= 2 ? 9 : 8
          );
        }
      }

      // 3. Anniversary in 14 days
      if (person.anniversary) {
        const days = daysUntilAnnual(person.anniversary);
        if (days <= 14 && days >= 0) {
          addSuggestion(person.id, 'anniversary',
            days === 0
              ? `¡Hoy es el aniversario con ${person.name}!`
              : `En ${days} día${days !== 1 ? 's' : ''} es el aniversario con ${person.name}`,
            'Recuérdalo con algo especial',
            days <= 1 ? 10 : 8
          );
        }
      }

      // 4. Job change signal not acknowledged in 7+ days
      const jobChange = signals.find(s =>
        s.person_id === person.id && s.type === 'job_change' &&
        (now.getTime() - new Date(s.created_at).getTime()) / 86_400_000 >= 3 &&
        (now.getTime() - new Date(s.created_at).getTime()) / 86_400_000 <= 21
      );
      if (jobChange) {
        const daysAgo = Math.floor((now.getTime() - new Date(jobChange.created_at).getTime()) / 86_400_000);
        addSuggestion(person.id, 'job_change_followup',
          `${person.name} cambió de trabajo hace ${daysAgo} días — las primeras semanas son difíciles`,
          'Mándale un mensaje de apoyo',
          8
        );
      }

      // 5. Achievement signal not acknowledged in 3+ days
      const achievement = signals.find(s =>
        s.person_id === person.id && s.type === 'achievement' &&
        (now.getTime() - new Date(s.created_at).getTime()) / 86_400_000 >= 3 &&
        (now.getTime() - new Date(s.created_at).getTime()) / 86_400_000 <= 14
      );
      if (achievement) {
        addSuggestion(person.id, 'achievement_acknowledge',
          `${person.name} tuvo un logro que aún no has reconocido`,
          'Felicítale y muestra interés genuino',
          7
        );
      }

      // 6. Relationship strength declining (if strength < 40 and there are interactions recorded)
      if (rel && (rel.strength ?? 0) < 40 && (rel.strength ?? 0) > 10) {
        const hasSignals = signals.some(s => s.person_id === person.id);
        if (hasSignals) {
          addSuggestion(person.id, 'strength_declining',
            `Tu relación con ${person.name} se está enfriando (fuerza: ${rel.strength}/100)`,
            'Retoma el contacto con una acción concreta',
            6
          );
        }
      }
    }

    if (suggestions.length > 0) {
      await db.from('ritual_suggestions').insert(suggestions);
      totalGenerated += suggestions.length;
    }
  }

  return Response.json({ processed: users.length, generated: totalGenerated });
}
