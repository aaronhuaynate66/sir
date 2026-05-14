export type UserId = string;
export type MemoryId = string;
export type SignalId = string;

export interface Timestamp {
  createdAt: Date;
  updatedAt: Date;
}

export interface Result<T, E = Error> {
  ok: true;
  value: T;
} | {
  ok: false;
  error: E;
}

export type AIProvider = 'ollama' | 'claude';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  timeoutMs: number;
}
