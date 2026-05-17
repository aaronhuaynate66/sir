import type { DbRelationship, DbPerson } from '../schema';

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq, order: mockOrder, limit: mockLimit }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockLimit = jest.fn() as jest.Mock;
const mockOrder = jest.fn(() => ({ limit: mockLimit }));

const mockEq: jest.Mock = jest.fn(function(this: unknown) {
  return {
    eq: mockEq,
    select: mockSelect,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    limit: mockLimit,
    then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
  };
});

const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect,
  eq: mockEq,
}));

jest.mock('../supabase', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

const mockSyncRel = jest.fn().mockResolvedValue(undefined);
jest.mock('../neo4j', () => ({
  syncRelationshipToNeo4j: mockSyncRel,
}));

jest.mock('../repositories/people', () => ({
  findPersonById: jest.fn().mockResolvedValue({
    id: 'person-1',
    user_id: 'user-1',
    name: 'Ana García',
    email: null,
    phone: null,
    organization: null,
    role: null,
    linkedin_url:  null,
    instagram_url: null,
    facebook_url:  null,
    twitter_url:   null,
    tiktok_url:    null,
    avatar_url:    null,
    notes:         null,
    tags:          [],
    language:      null,
    relationship_type: 'networking',
    birthday:      null,
    anniversary:   null,
    location:      null,
    education:     null,
    work_history:  null,
    cycle_data:            null,
    sensitive_context:     null,
    emotional_state:       null,
    love_language:         null,
    relationship_patterns: null,
    notes_professional:    null,
    notes_social:          null,
    notes_personal:        null,
    slug:                  null,
    created_at:    '2026-05-14T00:00:00Z',
    updated_at:    '2026-05-14T00:00:00Z',
  } as DbPerson),
}));

import { createRelationship, getRelationshipScore, updateStrength, findRelationshipsByUserId, deleteRelationship } from '../repositories/relationships';

const mockRel: DbRelationship = {
  id: 'rel-1',
  user_id: 'user-1',
  person_id: 'person-1',
  strength: 75,
  reciprocity: 60,
  trust_score: 0.8,
  relationship_type: 'professional',
  last_contact_at: '2026-05-01T00:00:00Z',
  contact_frequency_days: 30,
  stage: 'active',
  neo4j_sync_status: 'pending',
  created_at: '2026-05-14T00:00:00Z',
  updated_at: '2026-05-14T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('createRelationship', () => {
  it('inserts relationship and returns result', async () => {
    mockSingle.mockResolvedValue({ data: mockRel, error: null });
    const result = await createRelationship({ user_id: 'user-1', person_id: 'person-1', strength: 75 });
    expect(mockFrom).toHaveBeenCalledWith('relationships');
    expect(result.strength).toBe(75);
  });

  it('throws on Supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'constraint violation' } });
    await expect(createRelationship({ user_id: 'user-1', person_id: 'person-1' })).rejects.toThrow('createRelationship');
  });
});

describe('getRelationshipScore', () => {
  it('computes composite score', async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockRel, error: null });
    const score = await getRelationshipScore('user-1', 'person-1');
    expect(score).not.toBeNull();
    expect(score!.overall).toBeGreaterThan(0);
    expect(score!.overall).toBeLessThanOrEqual(100);
    expect(score!.stage).toBe('active');
  });

  it('returns null when relationship not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const score = await getRelationshipScore('user-1', 'nobody');
    expect(score).toBeNull();
  });
});

describe('updateStrength', () => {
  it('updates strength and reciprocity', async () => {
    mockSingle.mockResolvedValue({ data: { ...mockRel, strength: 90, reciprocity: 85 }, error: null });
    const result = await updateStrength('rel-1', 90, 85);
    expect(result.strength).toBe(90);
    expect(result.reciprocity).toBe(85);
  });
});

describe('findRelationshipsByUserId', () => {
  it('returns list ordered by strength', async () => {
    mockLimit.mockResolvedValue({ data: [mockRel], error: null });
    const results = await findRelationshipsByUserId('user-1');
    expect(mockFrom).toHaveBeenCalledWith('relationships');
    expect(results).toHaveLength(1);
    expect(results[0]!.strength).toBe(75);
  });

  it('returns empty array when none found', async () => {
    mockLimit.mockResolvedValue({ data: null, error: null });
    const results = await findRelationshipsByUserId('user-1');
    expect(results).toHaveLength(0);
  });
});

describe('deleteRelationship', () => {
  it('calls delete without throwing', async () => {
    await expect(deleteRelationship('rel-1')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('relationships');
  });
});
