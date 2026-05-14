import type { SignalType } from '@sir/shared';
import { getToken } from './auth-store';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export interface CreateSignalResponse {
  signalId: string;
  processed: boolean;
  layersActivated: string[];
}

export interface ApiError {
  error: string;
  code: string;
}

export async function sendSignal(
  type: SignalType,
  payload: Record<string, unknown> = {}
): Promise<CreateSignalResponse> {
  const token = getToken();
  if (!token) throw new Error('No active session');

  const response = await fetch(`${API_URL}/api/signals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, payload }),
  });

  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(err.error ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<CreateSignalResponse>;
}

export interface HumanStateBody {
  mood_score: number;
  energy_score: number;
  physical_tags: string[];
  emotional_tags: string[];
  notes?: string;
}

export interface HumanStateLog {
  id: string;
  user_id: string;
  mood_score: number;
  energy_score: number;
  physical_tags: string[];
  emotional_tags: string[];
  notes: string | null;
  composite_score: number;
  availability_score: number;
  interaction_risk: number;
  created_at: string;
}

export async function saveHumanState(body: HumanStateBody): Promise<HumanStateLog> {
  const token = getToken();
  if (!token) throw new Error('No active session');

  const response = await fetch(`${API_URL}/api/human-state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(err.error ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<HumanStateLog>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
