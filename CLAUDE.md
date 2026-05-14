# SIR — Sistema de Inteligencia Relacional

## Descripción
Sistema de inteligencia relacional con memoria multicapa, procesamiento AI local y en la nube, y grafos de relaciones.

## Stack

### Apps
| App | Stack | Ruta |
|-----|-------|------|
| Mobile | React Native + Expo SDK 51 | `/apps/mobile` |
| Web | Next.js 14 (App Router) | `/apps/web` |
| Admin | Next.js 14 (App Router) | `/apps/admin` |

### Packages
| Package | Propósito | Ruta |
|---------|-----------|------|
| `@sir/ai` | Integración Ollama + Claude API | `/packages/ai` |
| `@sir/db` | Supabase client + pgvector + Neo4j | `/packages/db` |
| `@sir/shared` | Types, utils, constantes compartidas | `/packages/shared` |

### Infraestructura
- **Base de datos relacional/vectorial**: Supabase (PostgreSQL + pgvector)
- **Grafo de relaciones**: Neo4j
- **AI local**: Ollama (modelos locales, primera opción)
- **AI cloud**: Claude API via Anthropic SDK (fallback)
- **Monorepo**: Turborepo

## Reglas de desarrollo

### TypeScript
- Strict mode siempre (`"strict": true` en todos los tsconfig)
- No `any` implícito
- Interfaces explícitas para todos los contratos entre packages

### Estructura
- Cada módulo/package tiene su propio `README.md`
- Exports limpios vía `index.ts` en cada package
- Path aliases configurados: `@sir/ai`, `@sir/db`, `@sir/shared`

### Tests
- Tests unitarios **antes** de continuar a la siguiente feature (TDD)
- Jest + Testing Library para web/admin
- Jest + React Native Testing Library para mobile
- Cobertura mínima: 80% en packages core

### AI
- Siempre intentar Ollama primero; fallback a Claude si falla o latencia > 3s
- Toda llamada AI debe tener timeout y manejo de error explícito
- Modelos preferidos Ollama: `llama3.2`, `nomic-embed-text` (embeddings)
- Modelo fallback Claude: `claude-sonnet-4-6`

## Arquitectura Memory Engine (8 capas)
1. **Sensory** — buffer temporal <30s, inputs raw
2. **Working** — contexto activo de sesión
3. **Episodic** — eventos con timestamp, almacenados en Supabase
4. **Semantic** — conocimiento factual, embeddings pgvector
5. **Procedural** — rutinas y workflows aprendidos
6. **Emotional** — estados afectivos y tonos de interacción
7. **Social** — grafo de relaciones en Neo4j
8. **Prophetic** — predicciones y patrones futuros

## Schema Supabase (referencia)
```sql
-- Tablas principales
users, memories, signals, relationships

-- Extensiones requeridas
pgvector, uuid-ossp
```

## Comandos útiles
```bash
# Dev
turbo dev

# Build
turbo build

# Test
turbo test

# Lint
turbo lint
```
