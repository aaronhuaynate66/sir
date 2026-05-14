import type { MemoryLayer } from '@sir/db';

export interface MemoryInput {
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
  importance?: number;
}

export interface MemoryQuery {
  userId: string;
  text?: string;
  layer?: MemoryLayer;
  limit?: number;
  timeRange?: { from: Date; to: Date };
}

export interface MemoryResult {
  id: string;
  layer: MemoryLayer;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  similarity?: number;
  createdAt: Date;
}

export interface ConsolidationResult {
  promoted: number;
  evicted: number;
}

export interface IMemoryLayer {
  readonly layer: MemoryLayer;
  store(input: MemoryInput): Promise<string>;
  retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
}

export interface IConsolidatable extends IMemoryLayer {
  consolidate(): Promise<ConsolidationResult>;
}

export function isConsolidatable(layer: IMemoryLayer): layer is IConsolidatable {
  return 'consolidate' in layer && typeof (layer as IConsolidatable).consolidate === 'function';
}

export interface RecallResult {
  results: MemoryResult[];
  layersSearched: MemoryLayer[];
  totalFound: number;
}
