export type MemoryLayer =
  | 'sensory'
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'emotional'
  | 'social'
  | 'prophetic';

export type SignalType =
  | 'interaction'
  | 'emotion'
  | 'location'
  | 'relationship'
  | 'task'
  | 'insight'
  | 'external';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbMemory {
  id: string;
  user_id: string;
  layer: MemoryLayer;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  importance: number;
  accessed_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSignal {
  id: string;
  user_id: string;
  type: SignalType;
  payload: Record<string, unknown>;
  processed: boolean;
  memory_id: string | null;
  created_at: string;
}

export type RelationshipType = 'personal' | 'professional' | 'family';
export type RelationshipStage = 'prospect' | 'active' | 'strategic' | 'dormant';

export interface DbPerson {
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

export interface DbRelationship {
  id: string;
  user_id: string;
  person_id: string;
  strength: number;
  reciprocity: number;
  trust_score: number;
  relationship_type: RelationshipType;
  last_contact_at: string | null;
  contact_frequency_days: number | null;
  stage: RelationshipStage;
  created_at: string;
  updated_at: string;
}

export type InsertPerson = Pick<DbPerson, 'user_id' | 'name'> &
  Partial<Pick<DbPerson, 'email' | 'phone' | 'organization' | 'role' |
    'linkedin_url' | 'avatar_url' | 'notes' | 'tags' | 'language'>>;

export type InsertRelationship = Pick<DbRelationship, 'user_id' | 'person_id'> &
  Partial<Pick<DbRelationship, 'strength' | 'reciprocity' | 'trust_score' |
    'relationship_type' | 'last_contact_at' | 'contact_frequency_days' | 'stage'>>;

export interface DbSearchResult {
  id: string;
  layer: MemoryLayer;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  similarity: number;
  created_at: string;
}

// Tipos de inserción (sin campos auto-generados)
export type InsertUser = Pick<DbUser, 'email' | 'name'> &
  Partial<Pick<DbUser, 'avatar_url' | 'preferences'>>;

export type InsertMemory = Pick<DbMemory, 'user_id' | 'layer' | 'content'> &
  Partial<Pick<DbMemory, 'embedding' | 'metadata' | 'importance' | 'expires_at' | 'accessed_at'>>;

export type InsertSignal = Pick<DbSignal, 'user_id' | 'type'> &
  Partial<Pick<DbSignal, 'payload' | 'memory_id'>>;
