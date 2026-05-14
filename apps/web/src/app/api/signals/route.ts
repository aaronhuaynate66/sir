import { NextResponse } from 'next/server';
import { handleCreateSignal } from '@/handlers/signals';
import { validateCreateSignalBody, ValidationError } from '@/types/api';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null);
    const validated = validateCreateSignalBody(body);
    const result = await handleCreateSignal(validated);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    console.error('[POST /api/signals]', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
