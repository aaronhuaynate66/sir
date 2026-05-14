import { WorkingMemory } from '../memory/layers/working';

describe('WorkingMemory', () => {
  it('stores and retrieves entries', async () => {
    const mem = new WorkingMemory();
    await mem.store({ userId: 'u1', content: 'thought A', importance: 0.5 });
    await mem.store({ userId: 'u1', content: 'thought B', importance: 0.6 });

    const results = await mem.retrieve({ userId: 'u1' });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.content)).toContain('thought A');
  });

  it('evicts least important entry when at capacity', async () => {
    const mem = new WorkingMemory(2);
    await mem.store({ userId: 'u1', content: 'low',    importance: 0.2 });
    await mem.store({ userId: 'u1', content: 'medium', importance: 0.5 });
    await mem.store({ userId: 'u1', content: 'new',    importance: 0.6 });

    const results = await mem.retrieve({ userId: 'u1' });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.content)).not.toContain('low');
  });

  it('keeps sessions isolated per user', async () => {
    const mem = new WorkingMemory();
    await mem.store({ userId: 'u1', content: 'u1 only' });
    await mem.store({ userId: 'u2', content: 'u2 only' });

    const u1 = await mem.retrieve({ userId: 'u1' });
    expect(u1).toHaveLength(1);
    expect(u1[0]!.content).toBe('u1 only');
  });

  it('consolidate promotes entries >= 0.6 importance', async () => {
    const mem = new WorkingMemory();
    const promoted: string[] = [];

    mem.setConsolidationHandler(async (entries) => {
      promoted.push(...entries.map((e) => e.content));
    });

    await mem.store({ userId: 'u1', content: 'keep',  importance: 0.7 });
    await mem.store({ userId: 'u1', content: 'drop',  importance: 0.4 });

    const result = await mem.consolidate();

    expect(result.promoted).toBe(1);
    expect(promoted).toContain('keep');
    expect(await mem.retrieve({ userId: 'u1' })).toHaveLength(0);
  });

  it('clearSession removes all entries for a user', async () => {
    const mem = new WorkingMemory();
    await mem.store({ userId: 'u1', content: 'data' });
    mem.clearSession('u1');

    const results = await mem.retrieve({ userId: 'u1' });
    expect(results).toHaveLength(0);
  });
});
