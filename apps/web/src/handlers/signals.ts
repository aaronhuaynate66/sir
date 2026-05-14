import { createSignal, markSignalProcessed } from '@sir/db';
import { getMemoryEngine } from '@/lib/engine';
import type { CreateSignalBody, CreateSignalResponse } from '@/types/api';

export async function handleCreateSignal(
  body: CreateSignalBody
): Promise<CreateSignalResponse> {
  // 1. Persistir señal en Supabase
  const signal = await createSignal({
    user_id: body.userId,
    type: body.type,
    payload: body.payload ?? {},
  });

  // 2. Procesar con el Memory Engine
  const engine = getMemoryEngine();
  await engine.process(signal);

  // 3. Marcar como procesada
  await markSignalProcessed(signal.id);

  // Las capas que se activaron según el tipo de señal
  const layerMap: Record<string, string[]> = {
    interaction:  ['sensory', 'working', 'episodic', 'semantic'],
    emotion:      ['emotional', 'working'],
    location:     ['episodic', 'working'],
    relationship: ['social', 'episodic'],
    task:         ['procedural', 'working', 'episodic'],
    insight:      ['semantic', 'prophetic'],
    external:     ['sensory', 'working'],
  };

  return {
    signalId: signal.id,
    processed: true,
    layersActivated: layerMap[body.type] ?? [],
  };
}
