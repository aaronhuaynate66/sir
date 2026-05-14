import { NextResponse } from 'next/server';
import { getUserFromRequest, AuthError } from '@/lib/auth';
import { createPerson } from '@sir/db';
import { ValidationError } from '@/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const userId = await getUserFromRequest(req);
    const body = (await req.json()) as Record<string, unknown>;

    if (!body['name'] || typeof body['name'] !== 'string' || !body['name'].trim()) {
      throw new ValidationError('name is required', 'INVALID_BODY');
    }

    const person = await createPerson({
      user_id: userId,
      name:    (body['name'] as string).trim(),
      ...(body['email']        ? { email:        body['email']        as string } : {}),
      ...(body['phone']        ? { phone:        body['phone']        as string } : {}),
      ...(body['organization'] ? { organization: body['organization'] as string } : {}),
      ...(body['role']         ? { role:         body['role']         as string } : {}),
      ...(body['notes']        ? { notes:        body['notes']        as string } : {}),
    });

    return NextResponse.json(person, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError)      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    console.error('[POST /api/people]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
