export interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  provider: 'ollama' | 'claude';
  model: string;
  durationMs: number;
}

export interface EmbedOptions {
  text: string;
}

export interface EmbedResult {
  embedding: number[];
  provider: 'ollama' | 'claude';
  model: string;
}

export interface AIClient {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  embed(options: EmbedOptions): Promise<EmbedResult>;
  isAvailable(): Promise<boolean>;
}
