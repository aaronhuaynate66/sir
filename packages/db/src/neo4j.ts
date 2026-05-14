import neo4j, { Driver } from 'neo4j-driver';
import type { Neo4jConfig } from './types';

let _driver: Driver | null = null;

export function getNeo4jDriver(config?: Neo4jConfig): Driver {
  if (_driver) return _driver;

  const uri = config?.uri ?? process.env['NEO4J_URI'] ?? 'bolt://localhost:7687';
  const user = config?.user ?? process.env['NEO4J_USER'] ?? 'neo4j';
  const password = config?.password ?? process.env['NEO4J_PASSWORD'];

  if (!password) {
    throw new Error('Missing NEO4J_PASSWORD');
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  return _driver;
}

export async function closeNeo4jDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
