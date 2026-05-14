import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_DEFAULT_MODEL } from '@sir/shared';
import type { AIClient, GenerateOptions, GenerateResult, EmbedOptions, EmbedResult } from './types';

export class ClaudeClient implements AIClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model = CLAUDE_DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const start = Date.now();
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      text,
      provider: 'claude',
      model: this.model,
      durationMs: Date.now() - start,
    };
  }

  async embed(_options: EmbedOptions): Promise<EmbedResult> {
    // Claude does not have a native embeddings API; this should not be called directly.
    throw new Error('Claude does not support embeddings. Use Ollama for embeddings.');
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env['ANTHROPIC_API_KEY']);
  }
}
