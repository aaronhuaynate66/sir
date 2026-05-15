import type { DbPerson } from '../schema';

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq, or: mockOr, order: mockOrder, limit: mockLimit }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockLimit = jest.fn() as jest.Mock;
const mockOrder = jest.fn(() => ({ limit: mockLimit, maybeSingle: mockMaybeSingle }));
const mockOr = jest.fn(() => ({ order: mockOrder }));

const mockEq: jest.Mock = jest.fn(function(this: unknown) {
  return {
    eq: mockEq,
    or: mockOr,
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

jest.mock('../neo4j', () => ({
  syncPersonToNeo4j: jest.fn().mockResolvedValue(undefined),
}));

import { createPerson, findPersonById, findPeopleByUserId, searchPeople, updatePerson, deletePerson } from '../repositories/people';

const mockPerson: DbPerson = {
  id: 'person-1',
  user_id: 'user-1',
  name: 'Ana García',
  email: 'ana@example.com',
  phone: null,
  organization: 'Acme Corp',
  role: 'CTO',
  linkedin_url:  null,
  instagram_url: null,
  avatar_url:    null,
  notes:         null,
  tags:          ['tech', 'investor'],
  language:      'es',
  relationship_type: 'professional',
  birthday:      null,
  anniversary:   null,
  created_at:    '2026-05-14T00:00:00Z',
  updated_at:    '2026-05-14T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('createPerson', () => {
  it('inserts person and returns result', async () => {
    mockSingle.mockResolvedValue({ data: mockPerson, error: null });
    const result = await createPerson({ user_id: 'user-1', name: 'Ana García', organization: 'Acme Corp' });
    expect(mockFrom).toHaveBeenCalledWith('people');
    expect(result.name).toBe('Ana García');
  });

  it('throws on Supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert error' } });
    await expect(createPerson({ user_id: 'user-1', name: 'Test' })).rejects.toThrow('createPerson: insert error');
  });
});

describe('findPersonById', () => {
  it('returns person when found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockPerson, error: null });
    const result = await findPersonById('person-1');
    expect(result).toEqual(mockPerson);
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await findPersonById('missing');
    expect(result).toBeNull();
  });
});

describe('findPeopleByUserId', () => {
  it('returns list ordered by name', async () => {
    mockLimit.mockResolvedValue({ data: [mockPerson], error: null });
    const results = await findPeopleByUserId('user-1');
    expect(mockFrom).toHaveBeenCalledWith('people');
    expect(results).toHaveLength(1);
  });
});

describe('searchPeople', () => {
  it('searches by name/org/email', async () => {
    mockLimit.mockResolvedValue({ data: [mockPerson], error: null });
    const results = await searchPeople('user-1', 'Ana');
    expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('Ana'));
    expect(results).toHaveLength(1);
  });
});

describe('updatePerson', () => {
  it('updates and returns the updated person', async () => {
    mockSingle.mockResolvedValue({ data: { ...mockPerson, name: 'Ana Updated' }, error: null });
    const result = await updatePerson('person-1', { name: 'Ana Updated' });
    expect(mockFrom).toHaveBeenCalledWith('people');
    expect(result.name).toBe('Ana Updated');
  });

  it('throws on Supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'update error' } });
    await expect(updatePerson('person-1', { name: 'X' })).rejects.toThrow('updatePerson');
  });
});

describe('deletePerson', () => {
  it('calls delete without throwing', async () => {
    await expect(deletePerson('person-1')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('people');
  });
});
