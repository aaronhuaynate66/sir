import { AI_TIMEOUT_MS } from '@sir/shared';
import type { AIClient, GenerateOptions, GenerateResult, EmbedOptions, EmbedResult } from './types';
import { OllamaClient } from './ollama';
import { ClaudeClient } from './claude';

export class SIRAIClient implements AIClient {
  private ollama: OllamaClient;
  private claude: ClaudeClient;

  constructor() {
    this.ollama = new OllamaClient();
    this.claude = new ClaudeClient();
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const ollamaAvailable = await this.withTimeout(
      this.ollama.isAvailable(),
      AI_TIMEOUT_MS
    );

    if (ollamaAvailable) {
      try {
        return await this.withTimeout(this.ollama.generate(options), AI_TIMEOUT_MS);
      } catch {
        // fallback to Claude
      }
    }

    return this.claude.generate(options);
  }

  async embed(options: EmbedOptions): Promise<EmbedResult> {
    const ollamaAvailable = await this.withTimeout(
      this.ollama.isAvailable(),
      AI_TIMEOUT_MS
    );

    if (ollamaAvailable) {
      try {
        return await this.withTimeout(this.ollama.embed(options), AI_TIMEOUT_MS);
      } catch {
        // fallback to Claude
      }
    }

    return this.claude.embed(options);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      ),
    ]);
  }
}
