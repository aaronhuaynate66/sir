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

export interface SignalProcessResult {
  layersActivated: MemoryLayer[];
  context: MemoryResult[];
  content: string;
  response: string;
}

const SIR_SYSTEM_PROMPT =
  'Eres SIR (Sistema de Inteligencia Relacional), un asistente de inteligencia personal. ' +
  'Tu función es ayudar al usuario a gestionar sus relaciones, memoria y contexto personal. ' +
  'Responde en el mismo idioma del usuario, de forma concisa y útil (máximo 3 oraciones). ' +
  'Si hay contexto de memoria relevante, úsalo para personalizar tu respuesta.';

const SIGNAL_ACK: Partial<Record<DbSignal['type'], string>> = {
  emotion:      'Estado emocional registrado en memoria.',
  location:     'Ubicación registrada.',
  relationship: 'Interacción registrada y relación actualizada.',
  task:         'Tarea capturada en memoria procedural.',
  external:     'Señal externa procesada.',
};

function extractContent(signal: DbSignal): string {
  const p = (signal.payload ?? {}) as Record<string, unknown>;

  switch (signal.type) {
    case 'interaction':
      return typeof p['message'] === 'string' ? p['message'] : JSON.stringify(p);
    case 'emotion': {
      const parts = [
        p['emotion']   ? `Estado emocional: ${p['emotion']}` : null,
        p['intensity'] ? `Intensidad: ${p['intensity']}` : null,
        typeof p['notes'] === 'string' && p['notes'] ? p['notes'] : null,
      ].filter(Boolean);
      return parts.join('. ') || 'Estado emocional registrado';
    }
    case 'relationship': {
      const name    = p['person_name'] ?? 'persona desconocida';
      const quality = p['quality']     ?? 3;
      const notes   = typeof p['notes'] === 'string' && p['notes'] ? `. ${p['notes']}` : '';
      return `Interacción con ${name}: calidad ${quality}/5${notes}`;
    }
    case 'insight':
      return typeof p['insight'] === 'string' ? p['insight'] : JSON.stringify(p);
    case 'task':
      return typeof p['task'] === 'string' ? p['task'] : JSON.stringify(p);
    default: {
      const values = Object.values(p).filter(v => typeof v === 'string' && v.length > 0);
      return values.join(' ') || JSON.stringify(p);
    }
  }
}

function scoreImportance(type: DbSignal['type'], content: string): number {
  const base: Record<DbSignal['type'], number> = {
    interaction:  0.50,
    emotion:      0.65,
    location:     0.35,
    relationship: 0.75,
    task:         0.55,
    insight:      0.85,
    external:     0.30,
  };
  const lengthBoost = Math.min(0.15, content.length / 1000);
  return Math.min(1.0, base[type] + lengthBoost);
}

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
    await this.processSignal(signal);
  }

  async processSignal(signal: DbSignal): Promise<Omit<SignalProcessResult, 'response'>> {
    const content    = extractContent(signal);
    const importance = scoreImportance(signal.type, content);
    const targetLayers = SIGNAL_LAYER_MAP[signal.type] ?? (['sensory'] as MemoryLayer[]);

    // Recall relevant context before storing so the caller can use it for response generation
    let context: MemoryResult[] = [];
    if (signal.type === 'interaction' || signal.type === 'insight') {
      try {
        const recalled = await this.recall({ userId: signal.user_id, text: content, limit: 5 });
        context = recalled.results;
      } catch {
        // Recall failure is non-fatal
      }
    }

    const p = (signal.payload ?? {}) as Record<string, unknown>;
    const input: MemoryInput = {
      userId:  signal.user_id,
      content,
      metadata: {
        signalId:   signal.id,
        signalType: signal.type,
        ...p,
        // Map person_id → relatedUserId so SocialMemory can use it
        ...(signal.type === 'relationship' && p['person_id']
          ? { relatedUserId: p['person_id'] }
          : {}),
      },
      importance,
    };

    await Promise.all(
      targetLayers.map(layerName => {
        const layer = this.layers.get(layerName);
        return layer ? layer.store(input).catch(() => undefined) : Promise.resolve();
      })
    );

    return { layersActivated: targetLayers, context, content };
  }

  async processAndRespond(signal: DbSignal): Promise<SignalProcessResult> {
    const { layersActivated, context, content } = await this.processSignal(signal);

    let response: string;

    if (signal.type === 'interaction' || signal.type === 'insight') {
      try {
        const contextSnippets = context.length > 0
          ? '\n\n[Memoria relevante:\n' +
            context.slice(0, 5).map(r => `• ${r.content.slice(0, 200)}`).join('\n') +
            ']'
          : '';

        const result = await this.ai.generate({
          prompt:       content + contextSnippets,
          systemPrompt: SIR_SYSTEM_PROMPT,
          maxTokens:    300,
        });
        response = result.text;
      } catch {
        response = 'Procesé tu mensaje y lo guardé en memoria.';
      }
    } else {
      response = SIGNAL_ACK[signal.type] ?? 'Registrado.';
    }

    return { layersActivated, context, content, response };
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
