import type { SignalType } from '@sir/db';

// userId viene del JWT — no se incluye en el body
export interface CreateSignalBody {
  type: SignalType;
  payload?: Record<string, unknown>;
}

export interface CreateSignalResponse {
  signalId: string;
  processed: boolean;
  layersActivated: string[];
  response: string;
}

export interface ApiError {
  error: string;
  code: string;
}

const SIGNAL_TYPES: SignalType[] = [
  'interaction', 'emotion', 'location',
  'relationship', 'task', 'insight', 'external',
];

export function validateCreateSignalBody(body: unknown): CreateSignalBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Body must be a JSON object', 'INVALID_BODY');
  }

  const b = body as Record<string, unknown>;

  if (!b['type'] || !SIGNAL_TYPES.includes(b['type'] as SignalType)) {
    throw new ValidationError(
      `type must be one of: ${SIGNAL_TYPES.join(', ')}`,
      'INVALID_SIGNAL_TYPE'
    );
  }

  if (b['payload'] !== undefined && (typeof b['payload'] !== 'object' || Array.isArray(b['payload']))) {
    throw new ValidationError('payload must be an object', 'INVALID_PAYLOAD');
  }

  return {
    type: b['type'] as SignalType,
    payload: (b['payload'] as Record<string, unknown>) ?? {},
  };
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
