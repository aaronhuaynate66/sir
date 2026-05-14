import type { DbSignal } from '@sir/db';
import type { AIClient } from '../types';
import type {
  IMemoryLayer,
  MemoryInput,
  MemoryQuery,
  MemoryResult,
  RecallResult,
  ConsolidationResult,
} from './types';
import { isConsolidatable } from './types';
import { SensoryMemory } from './layers/sensory';
import { WorkingMemory } from './layers/working';
import { EpisodicMemory } from './layers/episodic';
import { SemanticMemory } from './layers/semantic';
import { ProceduralMemory } from './layers/procedural';
import { EmotionalMemory } from './layers/emotional';
import { SocialMemory } from './layers/social';
import { PropheticMemory } from './layers/prophetic';
import type { MemoryLayer } from '@sir/db';

// Which layers to search for a given signal type
const SIGNAL_LAYER_MAP: Record<DbSignal['type'], MemoryLayer[]> = {
  interaction: ['sensory', 'working', 'episodic', 'semantic'],
  emotion:     ['emotional', 'working'],
  location:    ['episodic', 'working'],
  relationship:['social', 'episodic'],
  task:        ['procedural', 'working', 'episodic'],
  insight:     ['semantic', 'prophetic'],
  external:    ['sensory', 'working'],
};

export class MemoryEngine {
  private readonly layers: Map<MemoryLayer, IMemoryLayer>;

  constructor(private readonly ai: AIClient) {
    const sensory  = new SensoryMemory();
    const working  = new WorkingMemory();
    const episodic = new EpisodicMemory();
    const semantic = new SemanticMemory(ai);

    // sensory → working on consolidation
    sensory.setConsolidationHandler(async (entries) => {
      for (const entry of entries) {
        await working.store({
          userId: entry.userId,
          content: entry.content,
          metadata: entry.metadata,
          importance: entry.importance,
        });
      }
    });

    // working → episodic + semantic on consolidation
    working.setConsolidationHandler(async (entries) => {
      for (const entry of entries) {
        await episodic.store({
          userId: entry.userId,
          content: entry.content,
          metadata: entry.metadata,
          importance: entry.importance,
        });
        if (entry.importance >= 0.7) {
          await semantic.store({
            userId: entry.userId,
            content: entry.content,
            metadata: entry.metadata,
            importance: entry.importance,
          });
        }
      }
    });

    this.layers = new Map<MemoryLayer, IMemoryLayer>([
      ['sensory',    sensory],
      ['working',    working],
      ['episodic',   episodic],
      ['semantic',   semantic],
      ['procedural', new ProceduralMemory()],
      ['emotional',  new EmotionalMemory()],
      ['social',     new SocialMemory()],
      ['prophetic',  new PropheticMemory()],
    ]);
  }

  async process(signal: DbSignal): Promise<void> {
    const targetLayers = SIGNAL_LAYER_MAP[signal.type] ?? ['sensory'];
    const input: MemoryInput = {
      userId: signal.user_id,
      content: JSON.stringify(signal.payload),
      metadata: { signalId: signal.id, signalType: signal.type },
    };

    await Promise.all(
      targetLayers.map((layerName) => {
        const layer = this.layers.get(layerName);
        return layer ? layer.store(input) : Promise.resolve();
      })
    );
  }

  async recall(query: MemoryQuery): Promise<RecallResult> {
    const layersToSearch: MemoryLayer[] = query.layer
      ? [query.layer]
      : ['working', 'episodic', 'semantic', 'procedural', 'emotional', 'social', 'prophetic'];

    const searches = layersToSearch.map(async (layerName) => {
      const layer = this.layers.get(layerName);
      if (!layer) return [];
      try {
        return await layer.retrieve(query);
      } catch {
        return [];
      }
    });

    const allResults = (await Promise.all(searches)).flat();

    // Deduplicate by id and sort by importance + similarity
    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    deduped.sort((a, b) => {
      const scoreA = a.importance + (a.similarity ?? 0);
      const scoreB = b.importance + (b.similarity ?? 0);
      return scoreB - scoreA;
    });

    return {
      results: deduped.slice(0, query.limit ?? 20),
      layersSearched: layersToSearch,
      totalFound: deduped.length,
    };
  }

  async consolidate(): Promise<Record<MemoryLayer, ConsolidationResult>> {
    const results: Partial<Record<MemoryLayer, ConsolidationResult>> = {};

    // Consolidate in order: sensory first, then working
    for (const [name, layer] of this.layers) {
      if (isConsolidatable(layer)) {
        results[name] = await layer.consolidate();
      }
    }

    return results as Record<MemoryLayer, ConsolidationResult>;
  }

  getLayer<T extends IMemoryLayer>(name: MemoryLayer): T {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`Layer '${name}' not found`);
    return layer as T;
  }
}
