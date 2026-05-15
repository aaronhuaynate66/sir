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

export type SocialSignalType =
  | 'promotion'
  | 'job_change'
  | 'travel'
  | 'birthday'
  | 'publication'
  | 'life_event'
  | 'health_event'
  | 'achievement'
  | 'loss';

export type SubscriptionStatus = 'free' | 'pro' | 'enterprise';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  revenuecat_user_id: string | null;
  subscription_expires_at: string | null;
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
  // Social intelligence fields (added in migration 000006)
  signal_type: SocialSignalType | null;
  opportunity_score: number | null;
  action_recommendation: string | null;
  person_id: string | null;
  processed_at: string | null;
  source: string;
}

export type RelationshipType = 'personal' | 'professional' | 'family';
export type RelationshipStage = 'prospect' | 'active' | 'strategic' | 'dormant';

export type PersonRelationshipType =
  | 'professional'
  | 'networking'
  | 'family'
  | 'personal'
  | 'strategic'
  | 'developing';

export interface DbPerson {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  role: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  avatar_url: string | null;
  notes: string | null;
  tags: string[];
  language: string | null;
  relationship_type: PersonRelationshipType;
  birthday: string | null;
  anniversary: string | null;
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
  neo4j_sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
  updated_at: string;
}

export type InsertPerson = Pick<DbPerson, 'user_id' | 'name'> &
  Partial<Pick<DbPerson, 'email' | 'phone' | 'organization' | 'role' |
    'linkedin_url' | 'instagram_url' | 'avatar_url' | 'notes' | 'tags' | 'language' |
    'relationship_type' | 'birthday' | 'anniversary'>>;

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
  Partial<Pick<DbSignal, 'payload' | 'memory_id' | 'processed' |
    'signal_type' | 'opportunity_score' | 'action_recommendation' |
    'person_id' | 'processed_at' | 'source'>>;

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'birthday_reminder'
  | 'anniversary_reminder'
  | 'reconnect_suggestion'
  | 'signal_opportunity'
  | 'weekly_digest'
  | 'briefing_ready';

export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationStatus  = 'pending' | 'sent' | 'failed' | 'read';

export interface DbNotificationLog {
  id:            string;
  user_id:       string;
  type:          NotificationType;
  channel:       NotificationChannel;
  title:         string;
  body:          string;
  person_id:     string | null;
  signal_id:     string | null;
  urgency_score: number;
  sent_at:       string | null;
  read_at:       string | null;
  status:        NotificationStatus;
  metadata:      Record<string, unknown>;
  created_at:    string;
}

export type InsertNotificationLog =
  Pick<DbNotificationLog, 'user_id' | 'type' | 'channel' | 'title' | 'body'> &
  Partial<Pick<DbNotificationLog, 'person_id' | 'signal_id' | 'urgency_score' |
    'metadata' | 'sent_at' | 'status'>>;
