import { OLLAMA_BASE_URL, OLLAMA_DEFAULT_MODEL, OLLAMA_EMBED_MODEL } from '@sir/shared';
import type { AIClient, GenerateOptions, GenerateResult, EmbedOptions, EmbedResult } from './types';

export class OllamaClient implements AIClient {
  private baseUrl: string;

  constructor(baseUrl = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_DEFAULT_MODEL,
        prompt: options.systemPrompt
          ? `${options.systemPrompt}\n\n${options.prompt}`
          : options.prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    return {
      text: data.response,
      provider: 'ollama',
      model: OLLAMA_DEFAULT_MODEL,
      durationMs: Date.now() - start,
    };
  }

  async embed(options: EmbedOptions): Promise<EmbedResult> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: options.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    return {
      embedding: data.embedding,
      provider: 'ollama',
      model: OLLAMA_EMBED_MODEL,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
