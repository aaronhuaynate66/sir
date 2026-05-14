import { createSignal, markSignalProcessed } from '@sir/db';
import { getMemoryEngine } from '@/lib/engine';
import type { CreateSignalBody, CreateSignalResponse } from '@/types/api';

export async function handleCreateSignal(
  userId: string,
  body: CreateSignalBody
): Promise<CreateSignalResponse> {
  const signal = await createSignal({
    user_id: userId,
    type: body.type,
    payload: body.payload ?? {},
  });

  const { layersActivated, response } = await getMemoryEngine().processAndRespond(signal);
  await markSignalProcessed(signal.id);

  return {
    signalId: signal.id,
    processed: true,
    layersActivated: layersActivated as string[],
    response,
  };
}
