import { SensoryMemory } from '../memory/layers/sensory';

describe('SensoryMemory', () => {
  it('stores and retrieves an entry', async () => {
    const mem = new SensoryMemory();
    await mem.store({ userId: 'u1', content: 'hello', importance: 0.4 });

    const results = await mem.retrieve({ userId: 'u1' });

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('hello');
    expect(results[0]!.layer).toBe('sensory');
  });

  it('does not return entries for other users', async () => {
    const mem = new SensoryMemory();
    await mem.store({ userId: 'u1', content: 'u1 data' });
    await mem.store({ userId: 'u2', content: 'u2 data' });

    const results = await mem.retrieve({ userId: 'u1' });

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe('u1 data');
  });

  it('evicts entries after TTL', async () => {
    let now = 0;
    const clock = () => now;
    const mem = new SensoryMemory(1000, clock);

    await mem.store({ userId: 'u1', content: 'fresh' });
    now = 1001; // past TTL

    const results = await mem.retrieve({ userId: 'u1' });

    expect(results).toHaveLength(0);
  });

  it('consolidate promotes important entries and clears buffer', async () => {
    const mem = new SensoryMemory();
    const promoted: string[] = [];

    mem.setConsolidationHandler(async (entries) => {
      promoted.push(...entries.map((e) => e.content));
    });

    await mem.store({ userId: 'u1', content: 'low',  importance: 0.3 });
    await mem.store({ userId: 'u1', content: 'high', importance: 0.8 });

    const result = await mem.consolidate();

    expect(result.promoted).toBe(1);
    expect(promoted).toContain('high');
    expect(await mem.retrieve({ userId: 'u1' })).toHaveLength(0);
  });
});
