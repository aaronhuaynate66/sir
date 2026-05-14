import type { SignalType } from '@sir/shared';
import { getToken } from './auth-store';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

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

export interface DbPersonMobile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  role: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  notes: string | null;
  tags: string[];
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRelationshipMobile {
  id: string;
  user_id: string;
  person_id: string;
  strength: number;
  reciprocity: number;
  trust_score: number;
  relationship_type: string;
  last_contact_at: string | null;
  contact_frequency_days: number | null;
  stage: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonBody {
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  role?: string;
  notes?: string;
}

export async function createPerson(body: CreatePersonBody): Promise<DbPersonMobile> {
  const token = getToken();
  if (!token) throw new Error('No active session');

  const response = await fetch(`${API_URL}/api/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(err.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<DbPersonMobile>;
}

export interface RegisterInteractionBody {
  person_id: string;
  person_name?: string;
  quality: number;  // 1-5
  notes?: string;
}

export async function registerInteraction(body: RegisterInteractionBody): Promise<DbRelationshipMobile> {
  const token = getToken();
  if (!token) throw new Error('No active session');

  const response = await fetch(`${API_URL}/api/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(err.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<DbRelationshipMobile>;
}

export interface AdvisorSuggestion {
  person_id: string;
  person_name: string;
  person_org: string | null;
  urgency: 'high' | 'medium' | 'low';
  contact_score: number;
  reason: string;
  last_contact_at: string | null;
  days_since_contact: number | null;
  relationship_score: number;
}

export interface AdvisorResponse {
  user_available: boolean;
  availability_score: number;
  interaction_risk: number;
  suggestions: AdvisorSuggestion[];
  generated_at: string;
}

export async function getAdvisor(): Promise<AdvisorResponse> {
  const token = getToken();
  if (!token) throw new Error('No active session');

  const response = await fetch(`${API_URL}/api/advisor`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(err.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<AdvisorResponse>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
