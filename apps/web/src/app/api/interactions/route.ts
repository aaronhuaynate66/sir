import { NextResponse } from 'next/server';
import { getUserFromRequest, AuthError } from '@/lib/auth';
import {
  findRelationshipByPersonId,
  createRelationship,
  updateRelationship,
} from '@sir/db';
import { handleCreateSignal } from '@/handlers/signals';
import { ValidationError } from '@/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Strength delta per interaction quality (1-5)
const QUALITY_DELTA: Record<number, number> = { 1: -5, 2: -2, 3: 0, 4: 3, 5: 6 };

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const userId = await getUserFromRequest(req);
    const body = (await req.json()) as Record<string, unknown>;

    const personId   = body['person_id'] as string | undefined;
    const personName = body['person_name'] as string | undefined;
    const quality    = Math.min(5, Math.max(1, Number(body['quality']) || 3));
    const notes      = body['notes'] as string | undefined;

    if (!personId) throw new ValidationError('person_id is required', 'INVALID_BODY');

    const delta = QUALITY_DELTA[quality] ?? 0;
    const now   = new Date().toISOString();

    let rel = await findRelationshipByPersonId(userId, personId);

    if (rel) {
      rel = await updateRelationship(rel.id, {
        strength:       Math.min(100, Math.max(0, rel.strength   + delta)),
        reciprocity:    Math.min(100, Math.max(0, rel.reciprocity + Math.round(delta * 0.6))),
        last_contact_at: now,
        stage:          'active',
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

    // Fire relationship signal — non-blocking
    handleCreateSignal(userId, {
      type:    'relationship',
      payload: { person_id: personId, person_name: personName, quality, notes },
    }).catch(() => undefined);

    return NextResponse.json(rel, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError)       return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    console.error('[POST /api/interactions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
