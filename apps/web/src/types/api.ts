import type { SignalType } from '@sir/db';

export interface CreateSignalBody {
  userId: string;
  type: SignalType;
  payload?: Record<string, unknown>;
}

export interface CreateSignalResponse {
  signalId: string;
  processed: boolean;
  layersActivated: string[];
}

export interface ApiError {
  error: string;
  code: string;
}

export type ApiResponse<T> = T | ApiError;

const SIGNAL_TYPES: SignalType[] = [
  'interaction', 'emotion', 'location',
  'relationship', 'task', 'insight', 'external',
];

export function validateCreateSignalBody(body: unknown): CreateSignalBody {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Body must be a JSON object', 'INVALID_BODY');
  }

  const b = body as Record<string, unknown>;

  if (!b['userId'] || typeof b['userId'] !== 'string') {
    throw new ValidationError('userId is required and must be a string', 'MISSING_USER_ID');
  }

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
    userId: b['userId'] as string,
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
