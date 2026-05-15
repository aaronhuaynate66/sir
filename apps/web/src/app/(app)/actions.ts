'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import {
  createPerson,
  findRelationshipByPersonId,
  createRelationship,
  updateRelationship,
  createMemory,
  createSignal,
} from '@sir/db';
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

    // Build update payload — only non-null confirmed fields
    const update: Record<string, string | null> = {};
    if (confirmedData.linkedin_url  !== undefined) update['linkedin_url']  = confirmedData.linkedin_url  ?? null;
    if (confirmedData.instagram_url !== undefined) update['instagram_url'] = confirmedData.instagram_url ?? null;
    if (confirmedData.birthday      !== undefined) update['birthday']      = confirmedData.birthday      ?? null;
    if (confirmedData.anniversary   !== undefined) update['anniversary']   = confirmedData.anniversary   ?? null;
    if (confirmedData.organization  !== undefined && confirmedData.organization)  update['organization'] = confirmedData.organization;
    if (confirmedData.role          !== undefined && confirmedData.role)          update['role']         = confirmedData.role;
    if (confirmedData.email         !== undefined && confirmedData.email)         update['email']        = confirmedData.email;
    if (confirmedData.phone         !== undefined && confirmedData.phone)         update['phone']        = confirmedData.phone;

    if (Object.keys(update).length > 0) {
      const { error } = await db
        .from('people')
        .update(update)
        .eq('id', personId)
        .eq('user_id', user.id);
      if (error) throw error;
    }

    // Create a social memory
    const summary = confirmedData.raw_summary ?? `Screenshot de ${result.type} analizado`;
    await createMemory({
      user_id:    user.id,
      layer:      'social',
      content:    `[Screenshot ${result.type}] ${personName}: ${summary}`,
      importance: 60,
    }).catch(() => undefined);

    // Create a signal
    await createSignal({
      user_id: user.id,
      type:    'relationship',
      payload: {
        person_id:    personId,
        person_name:  personName,
        source:       `screenshot_${result.type}`,
        summary,
        extracted:    confirmedData,
      },
    }).catch(() => undefined);

    revalidatePath(`/people/${personId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al confirmar' };
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
