import { MemoryEngine } from '../memory/engine';
import type { AIClient } from '../types';
import type { DbSignal } from '@sir/db';

// Mock all @sir/db repository functions
jest.mock('@sir/db', () => ({
  createMemory: jest.fn().mockResolvedValue({
    id: 'mem-1',
    layer: 'episodic',
    content: '',
    metadata: {},
    importance: 0.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'u1',
    embedding: null,
    accessed_at: new Date().toISOString(),
    expires_at: null,
  }),
  getMemoriesByLayer: jest.fn().mockResolvedValue([]),
  searchMemories: jest.fn().mockResolvedValue([]),
  updateMemoryEmbedding: jest.fn().mockResolvedValue(undefined),
  getNeo4jDriver: jest.fn().mockReturnValue({
    session: jest.fn().mockReturnValue({
      run: jest.fn().mockResolvedValue({ records: [] }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  }),
}));

const mockAI: AIClient = {
  generate: jest.fn(),
  embed: jest.fn().mockResolvedValue({ embedding: new Array(768).fill(0.1), provider: 'ollama', model: 'nomic-embed-text' }),
  isAvailable: jest.fn().mockResolvedValue(true),
};

describe('MemoryEngine', () => {
  let engine: MemoryEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new MemoryEngine(mockAI);
  });

  describe('process()', () => {
    it('routes interaction signal to sensory, working, episodic, semantic layers', async () => {
      const signal: DbSignal = {
        id: 's1',
        user_id: 'u1',
        type: 'interaction',
        payload: { message: 'hello' },
        processed: false,
        memory_id: null,
        created_at: new Date().toISOString(),
      };

      await engine.process(signal);

      // Sensory + Working are in-memory; episodic + semantic call createMemory
      const { createMemory } = await import('@sir/db');
      expect(createMemory).toHaveBeenCalledTimes(2); // episodic + semantic
    });

    it('routes emotion signal to emotional and working layers', async () => {
      const signal: DbSignal = {
        id: 's2',
        user_id: 'u1',
        type: 'emotion',
        payload: { emotion: 'joy', intensity: 0.8 },
        processed: false,
        memory_id: null,
        created_at: new Date().toISOString(),
      };

      await engine.process(signal);

      const { createMemory } = await import('@sir/db');
      expect(createMemory).toHaveBeenCalledWith(
        expect.objectContaining({ layer: 'emotional' })
      );
    });
  });

  describe('recall()', () => {
    it('returns deduped results sorted by importance + similarity', async () => {
      const { getMemoriesByLayer } = await import('@sir/db');
      (getMemoriesByLayer as jest.Mock).mockResolvedValue([
        { id: 'm1', content: 'A', layer: 'episodic', metadata: {}, importance: 0.9, created_at: new Date().toISOString() },
        { id: 'm2', content: 'B', layer: 'episodic', metadata: {}, importance: 0.3, created_at: new Date().toISOString() },
      ]);

      const result = await engine.recall({ userId: 'u1', layer: 'episodic', limit: 10 });

      expect(result.results[0]!.importance).toBeGreaterThanOrEqual(result.results[1]!.importance);
      expect(result.layersSearched).toContain('episodic');
    });

    it('searches all non-sensory layers when no layer specified', async () => {
      const result = await engine.recall({ userId: 'u1', limit: 5 });

      expect(result.layersSearched).not.toContain('sensory');
      expect(result.layersSearched.length).toBeGreaterThan(1);
    });

    it('does not throw if a layer fails', async () => {
      const { getMemoriesByLayer } = await import('@sir/db');
      (getMemoriesByLayer as jest.Mock).mockRejectedValue(new Error('DB down'));

      await expect(engine.recall({ userId: 'u1' })).resolves.toBeDefined();
    });
  });

  describe('consolidate()', () => {
    it('consolidates sensory and working layers', async () => {
      // Store some data in sensory layer first
      const sensory = engine.getLayer('sensory');
      await sensory.store({ userId: 'u1', content: 'raw input', importance: 0.6 });

      const results = await engine.consolidate();

      expect(results['sensory']).toBeDefined();
      expect(results['working']).toBeDefined();
    });
  });

  describe('getLayer()', () => {
    it('returns the requested layer', () => {
      const layer = engine.getLayer('semantic');
      expect(layer.layer).toBe('semantic');
    });

    it('throws for unknown layer name', () => {
      expect(() => engine.getLayer('unknown' as never)).toThrow("Layer 'unknown' not found");
    });
  });
});
