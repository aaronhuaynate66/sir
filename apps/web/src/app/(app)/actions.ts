'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import {
  createPerson,
  findRelationshipByPersonId,
  createRelationship,
  updateRelationship,
  updatePerson,
  createMemory,
  createSignal,
} from '@sir/db';
import type { CycleData } from '@sir/db';
import { handleCreateSignal } from '@/handlers/signals';
import type { AnalysisResult } from '@/app/api/people/[id]/analyze-screenshot/route';

export type ActionResult = { error?: string };

// ── People ────────────────────────────────────────────────────────────────────

export async function createPersonAction(formData: FormData): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };

  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'El nombre es requerido' };

  try {
    const org   = (formData.get('organization') as string)?.trim() || null;
    const role  = (formData.get('role') as string)?.trim()         || null;
    const email = (formData.get('email') as string)?.trim()        || null;
    const notes = (formData.get('notes') as string)?.trim()        || null;
    const relType = ((formData.get('relationship_type') as string)?.trim() || 'networking') as import('@sir/db').PersonRelationshipType;

    await createPerson({
      user_id: user.id,
      name,
      relationship_type: relType,
      ...(org   ? { organization: org }   : {}),
      ...(role  ? { role }               : {}),
      ...(email ? { email }              : {}),
      ...(notes ? { notes }              : {}),
    });
    revalidatePath('/people');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al crear persona' };
  }
}

export async function updatePersonRelationshipTypeAction(
  personId: string,
  relationshipType: import('@sir/db').PersonRelationshipType,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };
  try {
    const db = getServiceClient();
    const { error } = await db.from('people')
      .update({ relationship_type: relationshipType })
      .eq('id', personId)
      .eq('user_id', user.id);
    if (error) throw error;
    revalidatePath(`/people/${personId}`);
    revalidatePath('/people');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar tipo' };
  }
}

// ── Interactions ──────────────────────────────────────────────────────────────

const QUALITY_DELTA: Record<number, number> = { 1: -5, 2: -2, 3: 0, 4: 3, 5: 6 };

export async function registerInteractionAction(
  personId: string,
  personName: string,
  quality: number,
  notes: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };

  try {
    const delta = QUALITY_DELTA[quality] ?? 0;
    const now   = new Date().toISOString();
    const userId = user.id;

    let rel = await findRelationshipByPersonId(userId, personId);
    if (rel) {
      rel = await updateRelationship(rel.id, {
        strength:        Math.min(100, Math.max(0, rel.strength    + delta)),
        reciprocity:     Math.min(100, Math.max(0, rel.reciprocity + Math.round(delta * 0.6))),
        last_contact_at: now,
        stage:           'active',
      });
    } else {
      rel = await createRelationship({
        user_id:         userId,
        person_id:       personId,
        strength:        Math.min(100, Math.max(0, 50 + delta)),
        last_contact_at: now,
        stage:           'active',
      });
    }

    handleCreateSignal(userId, {
      type:    'relationship',
      payload: { person_id: personId, person_name: personName, quality, notes: notes || undefined },
    }).catch(() => undefined);

    revalidatePath(`/people/${personId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al registrar interacción' };
  }
}

// ── Person extra fields ───────────────────────────────────────────────────────

export async function updatePersonExtraFieldsAction(
  personId: string,
  fields: {
    birthday?:      string | null;
    anniversary?:   string | null;
    instagram_url?: string | null;
    linkedin_url?:  string | null;
    location?:      string | null;
    education?:     string | null;
    notes?:         string | null;
    role?:          string | null;
    organization?:  string | null;
  },
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };
  try {
    const db = getServiceClient();
    const { error } = await db
      .from('people')
      .update(fields)
      .eq('id', personId)
      .eq('user_id', user.id);
    if (error) throw error;
    revalidatePath(`/people/${personId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar' };
  }
}

export async function confirmScreenshotAction(
  personId: string,
  personName: string,
  result: AnalysisResult,
  confirmedData: AnalysisResult['data'],
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };

  try {
    const db = getServiceClient();

    // Fetch existing person to merge — never overwrite already-set fields
    const { data: existing } = await db
      .from('people')
      .select('role, organization, location, education, linkedin_url, instagram_url, birthday, anniversary, notes, work_history, email, phone, cycle_data')
      .eq('id', personId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) throw new Error('Person not found');

    const ep = existing as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    // Only fill fields that are currently empty
    const mergeIfEmpty = (field: string, val: unknown) => {
      if (!ep[field] && val) update[field] = val;
    };

    mergeIfEmpty('role',          confirmedData.role);
    mergeIfEmpty('organization',  confirmedData.organization);
    mergeIfEmpty('location',      confirmedData.location);
    mergeIfEmpty('education',     confirmedData.education);
    mergeIfEmpty('linkedin_url',  confirmedData.linkedin_url);
    mergeIfEmpty('instagram_url', confirmedData.instagram_url);
    mergeIfEmpty('birthday',      confirmedData.birthday);
    mergeIfEmpty('anniversary',   confirmedData.anniversary);
    mergeIfEmpty('email',         confirmedData.email);
    mergeIfEmpty('phone',         confirmedData.phone);

    // Notes: concatenate
    if (confirmedData.notes) {
      update['notes'] = ep['notes']
        ? `${ep['notes']}\n\n${confirmedData.notes}`
        : confirmedData.notes;
    }

    // Work history: append entries not already present (match by role+company)
    if (confirmedData.work_history?.length) {
      const existingWH = (ep['work_history'] as import('@sir/db').WorkHistoryEntry[] | null) ?? [];
      const existingKeys = new Set(existingWH.map(e => `${e.role}|${e.company}`));
      const newEntries = confirmedData.work_history.filter(
        e => !existingKeys.has(`${e.role}|${e.company}`)
      );
      update['work_history'] = newEntries.length > 0
        ? [...existingWH, ...newEntries]
        : undefined; // nothing to add
      if (update['work_history'] === undefined) delete update['work_history'];
    }

    if (Object.keys(update).length > 0) {
      const { error } = await db
        .from('people')
        .update(update)
        .eq('id', personId)
        .eq('user_id', user.id);
      if (error) throw error;
    }

    const summary = confirmedData.raw_summary ?? `Screenshot de ${result.type} analizado`;
    const memoryOps: Promise<unknown>[] = [];

    // Social memory — raw summary
    memoryOps.push(
      createMemory({
        user_id:    user.id,
        layer:      'social',
        content:    `[Screenshot ${result.type}] ${personName}: ${summary}`,
        importance: 60,
      }).catch(() => undefined)
    );

    // Semantic memory — location
    if (confirmedData.location) {
      memoryOps.push(
        createMemory({
          user_id:    user.id,
          layer:      'semantic',
          content:    `${personName} se ubica en ${confirmedData.location}.`,
          importance: 50,
        }).catch(() => undefined)
      );
    }

    // Semantic memory — education
    if (confirmedData.education) {
      memoryOps.push(
        createMemory({
          user_id:    user.id,
          layer:      'semantic',
          content:    `${personName} estudió en ${confirmedData.education}.`,
          importance: 50,
        }).catch(() => undefined)
      );
    }

    // Semantic memory — work history (one memory with full history)
    if (confirmedData.work_history && confirmedData.work_history.length > 0) {
      const historyText = confirmedData.work_history
        .map((e: import('@/app/api/people/[id]/analyze-screenshot/route').WorkHistoryEntry) =>
          `• ${e.role} en ${e.company} (${e.period})`
        )
        .join('\n');
      memoryOps.push(
        createMemory({
          user_id:    user.id,
          layer:      'semantic',
          content:    `Historial laboral de ${personName}:\n${historyText}`,
          importance: 70,
        }).catch(() => undefined)
      );
    }

    // WhatsApp: cycle data — save to people record (merge: only if not already set)
    if (result.type === 'whatsapp' && confirmedData.cycle_data?.detected) {
      const existingCycle = ep['cycle_data'] as CycleData | null;
      if (!existingCycle?.detected) {
        const { error: cycleErr } = await db
          .from('people')
          .update({ cycle_data: confirmedData.cycle_data })
          .eq('id', personId)
          .eq('user_id', user.id);
        if (cycleErr) console.error('cycle_data update failed:', cycleErr.message);
      }
    }

    // WhatsApp: emotional memory
    if (result.type === 'whatsapp' && (confirmedData.conversation_tone || confirmedData.emotional_state)) {
      const parts: string[] = [];
      if (confirmedData.conversation_tone) parts.push(`Tono: ${confirmedData.conversation_tone}`);
      if (confirmedData.emotional_state)   parts.push(`Estado emocional: ${confirmedData.emotional_state}`);
      if (confirmedData.last_interaction_quality) parts.push(`Calidad: ${confirmedData.last_interaction_quality}`);
      memoryOps.push(
        createMemory({
          user_id:    user.id,
          layer:      'emotional',
          content:    `[WhatsApp con ${personName}] ${parts.join(' · ')}`,
          importance: 65,
        }).catch(() => undefined)
      );
    }

    await Promise.all(memoryOps);

    // WhatsApp: signal per topic
    if (result.type === 'whatsapp' && confirmedData.topics?.length) {
      for (const topic of confirmedData.topics) {
        await createSignal({
          user_id: user.id,
          type:    'insight',
          payload: {
            person_id:   personId,
            person_name: personName,
            source:      'screenshot_whatsapp',
            topic,
          },
        }).catch(() => undefined);
      }
    }

    // Signal
    await createSignal({
      user_id: user.id,
      type:    'relationship',
      payload: {
        person_id:   personId,
        person_name: personName,
        source:      `screenshot_${result.type}`,
        summary,
        extracted:   confirmedData,
      },
    }).catch(() => undefined);

    revalidatePath(`/people/${personId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al confirmar' };
  }
}

// ── Cycle Data ────────────────────────────────────────────────────────────────

export async function updateCycleDataAction(
  personId: string,
  cycleData: CycleData | null,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };
  try {
    await updatePerson(personId, { cycle_data: cycleData });
    revalidatePath(`/people/${personId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al actualizar' };
  }
}

// ── Human State ───────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export async function submitStateAction(
  moodScore: number,
  energyScore: number,
  physTags: string[],
  emotTags: string[],
  notes: string,
): Promise<ActionResult & { scores?: { composite_score: number; availability_score: number; interaction_risk: number } }> {
  const user = await getAuthUser();
  if (!user) return { error: 'No autenticado' };

  const moodNorm   = (moodScore   - 1) / 4;
  const energyNorm = (energyScore - 1) / 9;

  const negPhys  = ['cansado', 'enfermo'].filter(t => physTags.includes(t)).length;
  const posPhys  = ['descansado', 'activo'].filter(t => physTags.includes(t)).length;
  const physFact = clamp((posPhys - negPhys + 2) / 4, 0, 1);

  const negEmot  = ['ansioso', 'estresado'].filter(t => emotTags.includes(t)).length;
  const posEmot  = ['tranquilo', 'motivado', 'feliz'].filter(t => emotTags.includes(t)).length;
  const emotFact = clamp((posEmot - negEmot + 2) / 5, 0, 1);

  const composite_score    = Math.round(moodNorm * 40 + energyNorm * 30 + physFact * 15 + emotFact * 15);
  const availability_score = Math.round(moodNorm * 50 + energyNorm * 20 + emotFact * 30);
  const interaction_risk   = 100 - availability_score;

  try {
    await getServiceClient().from('human_state_logs').insert({
      user_id:        user.id,
      mood_score:     moodScore,
      energy_score:   energyScore,
      physical_tags:  physTags,
      emotional_tags: emotTags,
      notes:          notes || null,
      composite_score,
      availability_score,
      interaction_risk,
    });

    revalidatePath('/state');
    revalidatePath('/dashboard');
    return { scores: { composite_score, availability_score, interaction_risk } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar estado' };
  }
}
