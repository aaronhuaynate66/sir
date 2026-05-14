import { handleCreateSignal } from '../handlers/signals';
import { validateCreateSignalBody, ValidationError } from '../types/api';

// Mocks
jest.mock('@sir/db', () => ({
  createSignal: jest.fn().mockResolvedValue({
    id: 'sig-1',
    user_id: 'u-1',
    type: 'interaction',
    payload: {},
    processed: false,
    memory_id: null,
    created_at: new Date().toISOString(),
  }),
  markSignalProcessed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/engine', () => ({
  getMemoryEngine: jest.fn().mockReturnValue({
    process: jest.fn().mockResolvedValue(undefined),
  }),
}));

beforeEach(() => jest.clearAllMocks());

// --- validateCreateSignalBody ---

describe('validateCreateSignalBody', () => {
  it('accepts a valid body', () => {
    const result = validateCreateSignalBody({
      userId: 'u-1',
      type: 'interaction',
      payload: { message: 'hi' },
    });

    expect(result.userId).toBe('u-1');
    expect(result.type).toBe('interaction');
    expect(result.payload).toEqual({ message: 'hi' });
  });

  it('defaults payload to empty object when omitted', () => {
    const result = validateCreateSignalBody({ userId: 'u-1', type: 'emotion' });
    expect(result.payload).toEqual({});
  });

  it('throws MISSING_USER_ID when userId is absent', () => {
    expect(() => validateCreateSignalBody({ type: 'interaction' })).toThrow(ValidationError);
    try { validateCreateSignalBody({ type: 'interaction' }); } catch (e) {
      expect((e as ValidationError).code).toBe('MISSING_USER_ID');
    }
  });

  it('throws INVALID_SIGNAL_TYPE for unknown type', () => {
    try { validateCreateSignalBody({ userId: 'u-1', type: 'unknown' }); } catch (e) {
      expect((e as ValidationError).code).toBe('INVALID_SIGNAL_TYPE');
    }
  });

  it('throws INVALID_BODY for non-object input', () => {
    try { validateCreateSignalBody('string'); } catch (e) {
      expect((e as ValidationError).code).toBe('INVALID_BODY');
    }
    try { validateCreateSignalBody(null); } catch (e) {
      expect((e as ValidationError).code).toBe('INVALID_BODY');
    }
  });

  it('throws INVALID_PAYLOAD when payload is an array', () => {
    try {
      validateCreateSignalBody({ userId: 'u-1', type: 'task', payload: [1, 2] });
    } catch (e) {
      expect((e as ValidationError).code).toBe('INVALID_PAYLOAD');
    }
  });
});

// --- handleCreateSignal ---

describe('handleCreateSignal', () => {
  it('creates signal, processes it, marks it done, returns response', async () => {
    const result = await handleCreateSignal({
      userId: 'u-1',
      type: 'interaction',
      payload: { message: 'hello' },
    });

    const { createSignal, markSignalProcessed } = await import('@sir/db');
    const { getMemoryEngine } = await import('../lib/engine');

    expect(createSignal).toHaveBeenCalledWith({
      user_id: 'u-1',
      type: 'interaction',
      payload: { message: 'hello' },
    });
    expect(getMemoryEngine().process).toHaveBeenCalled();
    expect(markSignalProcessed).toHaveBeenCalledWith('sig-1');

    expect(result.signalId).toBe('sig-1');
    expect(result.processed).toBe(true);
    expect(result.layersActivated).toEqual(['sensory', 'working', 'episodic', 'semantic']);
  });

  it('returns correct layers for emotion signal', async () => {
    const result = await handleCreateSignal({
      userId: 'u-1',
      type: 'emotion',
      payload: { emotion: 'joy' },
    });

    expect(result.layersActivated).toEqual(['emotional', 'working']);
  });

  it('returns correct layers for task signal', async () => {
    const result = await handleCreateSignal({
      userId: 'u-1',
      type: 'task',
      payload: { task: 'escribir tests' },
    });

    expect(result.layersActivated).toEqual(['procedural', 'working', 'episodic']);
  });

  it('propagates DB errors', async () => {
    const { createSignal } = await import('@sir/db');
    (createSignal as jest.Mock).mockRejectedValueOnce(new Error('DB down'));

    await expect(
      handleCreateSignal({ userId: 'u-1', type: 'interaction' })
    ).rejects.toThrow('DB down');
  });
});
