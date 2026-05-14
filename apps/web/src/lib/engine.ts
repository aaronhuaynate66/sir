import { MemoryEngine, SIRAIClient } from '@sir/ai';

// Singleton — reutilizado entre hot-reloads en desarrollo
declare global {
  // eslint-disable-next-line no-var
  var __memoryEngine: MemoryEngine | undefined;
}

export function getMemoryEngine(): MemoryEngine {
  if (!global.__memoryEngine) {
    global.__memoryEngine = new MemoryEngine(new SIRAIClient());
  }
  return global.__memoryEngine;
}
