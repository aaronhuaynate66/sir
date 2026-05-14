# SIR — Master Plan

## Estado general
Última actualización: 2026-05-14
Versión en producción: `9ba40b7` (fix: add @anthropic-ai/sdk to apps/web deps)

## URLs de producción
- Web: https://sir-web.vercel.app
- Admin: https://sir-admin.vercel.app
- Repo: https://github.com/aaronhuaynate66/SIR

## Progreso general
```
███████████░░░░░░░░░ 9/17 módulos completados (53%)
```
✅ Completo: 9 | 🔄 Parcial: 1 | ⬜ Pendiente: 7

---

## Módulos

### 01 — Monorepo Inicial
**Estado:** ✅ Completo
**Deploy:** —
**Commit:** `12b0029` (2026-05-13)
**Prompt usado:** Inicializa un monorepo Turborepo con pnpm workspaces. Apps: `apps/web` (Next.js 14), `apps/admin` (Next.js 14), `apps/mobile` (Expo SDK 51). Packages: `packages/ai`, `packages/db`, `packages/shared`. TypeScript strict en todos. Configura `turbo.json` con tasks: build, dev, test, lint, type-check.
**Verificación:**
- [x] pnpm install sin errores
- [x] pnpm build pasa en todos los packages
- [x] turbo pipeline correcto (dependsOn: ["^build"])
**Notas:** pnpm workspaces + `workspace:*` protocol, TypeScript strict, Turborepo 2.x

---

### 02 — Supabase Schema
**Estado:** ✅ Completo
**Deploy:** —
**Commit:** `6562989` (2026-05-13)
**Prompt usado:** Crea el schema completo de Supabase en `packages/db`. Tablas: `users`, `memories` (con columna embedding vector(768) para pgvector), `signals`, `relationships`, `people`. Habilita extensiones pgvector y uuid-ossp. Crea RLS policies. Genera tipos TypeScript (`DbMemory`, `DbSignal`, `DbRelationship`) en `packages/db/src/schema.ts` y repositories con funciones CRUD en `packages/db/src/repositories/`.
**Verificación:**
- [x] Migración aplicada a Supabase remoto
- [x] Tipos exportados desde `@sir/db`
- [x] pgvector habilitado, columna embedding funcional
**Notas:** pgvector, RLS, migraciones en `supabase/migrations/`

---

### 03 — App Móvil Expo
**Estado:** ✅ Completo
**Deploy:** local
**Commit:** `9cc4c0b` (2026-05-14)
**Prompt usado:** Configura `apps/mobile` con Expo SDK 51, Expo Router v3, NativeWind (Tailwind para RN). Implementa pantallas: login/registro con Supabase Auth, home con briefing diario, conversación con AI. Conecta con `@sir/ai` y `@sir/db` vía API REST del app web. Configura `app.json` con bundle identifiers para iOS/Android.
**Verificación:**
- [x] `expo start` sin errores
- [x] Auth flow completo (login → home)
- [x] NativeWind styles aplican correctamente
**Notas:** Expo Router, NativeWind, Supabase Auth mobile

---

### 04 — Relationship Graph Visual
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Construye la visualización del grafo de relaciones en apps/web.

1. Instala react-flow (reactflow@^11) en apps/web
2. Crea apps/web/src/app/(app)/graph/page.tsx — Server Component que:
   - Fetches personas del usuario desde Supabase (tabla people)
   - Fetches relaciones desde Supabase (tabla relationships)
   - Pasa datos como props al componente cliente
3. Crea apps/web/src/app/(app)/graph/RelationshipGraph.tsx — Client Component:
   - Usa ReactFlow con nodos (personas) y aristas (relaciones)
   - Color de nodo por categoría (familia, trabajo, social, mentor)
   - Grosor de arista por strength (0-1)
   - Click en nodo abre panel lateral con detalles de la persona
   - Botón "Añadir relación" abre modal
4. Crea apps/web/src/app/(app)/graph/GraphControls.tsx — filtros:
   - Por categoría de relación
   - Por strength mínimo
5. Agrega link "Grafo" en Sidebar entre Personas y Señales
6. Commit: feat: relationship graph visual con react-flow
```
**Verificación:**
- [ ] Grafo renderiza con nodos reales
- [ ] Click en nodo muestra panel de detalles
- [ ] Filtros funcionan correctamente
**Notas:** react-flow, visualización D3-like, datos desde Neo4j/Supabase

---

### 05 — Memory Engine (8 capas)
**Estado:** ✅ Completo
**Deploy:** —
**Commit:** `875def5` (2026-05-13)
**Prompt usado:** Implementa el Memory Engine de 8 capas en `packages/ai/src/memory/`. Capas: Sensory (buffer <30s), Working (sesión activa), Episodic (eventos con timestamp), Semantic (embeddings pgvector), Procedural (workflows), Emotional (estados afectivos), Social (grafo Neo4j), Prophetic (predicciones). Clase `MemoryEngine` con métodos `process(signal)`, `recall(query)`, `consolidate()`. Tests unitarios con >80% coverage.
**Verificación:**
- [x] `pnpm turbo test --filter=@sir/ai` pasa
- [x] 8 capas instanciadas correctamente
- [x] `recall()` devuelve resultados ordenados por importance + similarity
**Notas:** pgvector embeddings, Neo4j social layer, consolidación automática

---

### 06 — Human State Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `7ed7690` (2026-05-14)
**Prompt usado:** Construye el Human State Engine. API `POST /api/human-state` que recibe señales de estado (mood 0-10, energy 0-10, stress 0-10, focus_score 0-10) y las almacena en Supabase. Pantalla mobile `/human-state` con sliders para input manual. Widget en dashboard web mostrando estado actual del usuario con indicadores de colores. Algoritmo de trend detection: compara últimas 7 entradas y calcula dirección.
**Verificación:**
- [x] API acepta y almacena estados
- [x] Mobile screen funcional con sliders
- [x] Dashboard widget muestra estado actual
**Notas:** mood, energy, stress, focus — scores 0-10, trend detection

---

### 07 — AI Briefing Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `e437bef` (2026-05-14)
**Prompt usado:** Construye el AI Briefing Engine v2 con streaming. API `GET /api/briefing/stream` que hace streaming de un briefing diario personalizado en 6 secciones: (1) Estado emocional/energía, (2) Top 3 personas a contactar hoy, (3) Señales sociales recientes, (4) Memorias relevantes del día, (5) Recomendaciones de acción, (6) Predicción del día. Usa Claude Haiku → Ollama llama3.2 → template estático como fallback. Implementa con Server-Sent Events. Componente cliente `BriefingStream.tsx` que consume el stream.
**Verificación:**
- [x] Streaming funciona (SSE headers correctos)
- [x] 6 secciones generadas por AI
- [x] Fallback a template si AI no disponible
**Notas:** SSE streaming, `\n\n__META__` sentinel, Claude Haiku primary, 6 secciones

---

### 08 — Social Signal Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `9a3c0d4` (2026-05-14)
**Prompt usado:** Construye el Social Signal Engine completo: (1) Migración SQL añadiendo columnas a tabla signals: signal_type (enum 9 valores), opportunity_score (0-100), action_recommendation, person_id, processed_at, source. (2) API POST /api/signals/capture con extracción AI (Claude Haiku → Ollama → reglas). (3) Página /signals con feed filtrable por tipo y persona, CaptureForm. (4) Widget "Oportunidades" en dashboard con top 3 señales. (5) Link "Señales" en Sidebar.
**Verificación:**
- [x] Migración SQL aplicada
- [x] API extrae signal_type con AI
- [x] Página /signals renderiza señales con filtros
- [x] Widget dashboard muestra oportunidades
**Notas:** 9 tipos de señal, score 0-100, AI extraction pipeline con 3 niveles de fallback. Vercel auto-deploy configurado y activo.

---

### 09 — Notification Engine
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Construye el Notification Engine para SIR.

1. Instala expo-notifications en apps/mobile
2. Crea packages/db/src/repositories/notifications.ts:
   - Tabla: notifications (id, user_id, title, body, data jsonb, 
     sent_at, read_at, channel text)
   - Funciones: createNotification, markAsRead, getUnread
3. Crea apps/web/src/app/api/notifications/send/route.ts:
   - Recibe: { user_id, title, body, data?, channel }
   - Valida con service role key
   - Guarda en DB + envía push via Expo Push API
4. Crea apps/mobile/src/hooks/useNotifications.ts:
   - Registra token de dispositivo en Supabase (tabla: push_tokens)
   - Escucha notificaciones en foreground/background
5. Trigger automático: al capturar señal con opportunity_score > 70,
   envía notificación "Nueva oportunidad con {nombre}"
6. Commit: feat: notification engine con expo push
```
**Verificación:**
- [ ] Token registrado en Supabase al abrir app
- [ ] Notificación push llega al dispositivo
- [ ] Trigger automático por opportunity_score > 70
**Notas:** Expo Push Notifications, trigger en capture API

---

### 10 — Analytics Event System
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Construye el sistema de Analytics para SIR.

1. Crea packages/db/src/repositories/analytics.ts:
   - Tabla: analytics_events (id, user_id, event_name, properties jsonb,
     session_id, created_at)
   - Función: trackEvent(userId, eventName, properties)
2. Crea packages/shared/src/analytics.ts:
   - Enum EVENT_NAMES con todos los eventos: 
     signal_captured, briefing_viewed, person_contacted,
     memory_recalled, state_updated, graph_viewed
   - Tipo AnalyticsEvent con propiedades tipadas por evento
3. Integra trackEvent en todas las APIs existentes:
   - /api/signals/capture → signal_captured
   - /api/briefing/stream → briefing_viewed
   - /api/human-state → state_updated
4. Crea apps/admin/src/app/(app)/analytics/page.tsx:
   - Gráfica de eventos por día (últimos 30 días)
   - Top 5 eventos más frecuentes
   - Usuarios activos diarios/semanales
5. Commit: feat: analytics event system
```
**Verificación:**
- [ ] Eventos se registran en tabla analytics_events
- [ ] Dashboard admin muestra gráficas con datos reales
- [ ] Todos los APIs existentes emiten eventos
**Notas:** Event sourcing ligero, sin dependencias externas (no PostHog)

---

### 11 — RevenueCat + Stripe
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Implementa monetización en SIR con RevenueCat (mobile) + Stripe (web).

1. Mobile — RevenueCat:
   - Instala react-native-purchases en apps/mobile
   - Configura entitlements: "pro" plan ($9.99/mes)
   - Crea apps/mobile/src/screens/Paywall.tsx con pricing
   - Hook usePurchases() que expone isPro, purchase(), restore()
   - Guard en pantallas premium (Graph, Analytics)

2. Web — Stripe:
   - Instala stripe en apps/web
   - Crea apps/web/src/app/api/stripe/checkout/route.ts:
     POST → crea Stripe Checkout Session → devuelve URL
   - Crea apps/web/src/app/api/stripe/webhook/route.ts:
     Procesa customer.subscription.created/deleted
   - Guarda subscription_status en tabla users de Supabase
   - Middleware en apps/web que verifica subscription en rutas /premium/*

3. Agrega columnas a tabla users:
   subscription_status (free|pro|enterprise), 
   stripe_customer_id, revenuecat_user_id, subscription_expires_at

4. Commit: feat: monetización RevenueCat mobile + Stripe web
```
**Verificación:**
- [ ] Checkout Stripe funciona en web (modo test)
- [ ] RevenueCat entitlement "pro" se activa en mobile
- [ ] Webhook actualiza subscription_status en Supabase
**Notas:** RevenueCat para iOS/Android, Stripe para web, shared subscription state en Supabase

---

### 12 — Admin Dashboard
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `64f52d5` (2026-05-14)
**Prompt usado:** Construye el admin dashboard en `apps/admin`. Página principal con KPIs: total usuarios, memorias por capa (gráfico), señales recientes (tabla), estado promedio de usuarios. Autenticación con Supabase Admin role. Sidebar con: Dashboard, Usuarios, Memorias, Señales, Configuración. Responsive, dark mode.
**Verificación:**
- [x] Build de apps/admin pasa sin errores
- [x] KPIs cargan con datos reales de Supabase
- [x] Autenticación admin funciona
**Notas:** Next.js 14 App Router, Supabase service role, KPIs en tiempo real

---

### 13 — i18n ES/EN
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `af4b234` (2026-05-14)
**Prompt usado:** Agrega internacionalización completa a apps/web y apps/mobile. Web: instala next-intl, configura middleware de detección de locale, crea carpetas `messages/es.json` y `messages/en.json` con todas las traducciones de UI. Mobile: instala i18next + react-i18next, configura detección de idioma del dispositivo. Selector de idioma en configuración. Idioma por defecto: español.
**Verificación:**
- [x] Web sirve /es y /en correctamente
- [x] Mobile detecta idioma del dispositivo
- [x] Todas las strings de UI están traducidas
**Notas:** next-intl para web, i18next para mobile, ES como idioma por defecto

---

### 14 — Neo4j Graph Engine
**Estado:** 🔄 Parcial
**Deploy:** —
**Commit:** `7d9123c` (2026-05-14)
**Prompt usado:**
```
Completa la integración Neo4j AuraDB para sincronización bidireccional.

Estado actual: cliente Neo4j configurado en packages/db, 
tabla relationships en Supabase con neo4j_sync_status.

Pendiente:
1. Crea packages/db/src/neo4j/sync.ts:
   - syncRelationshipToNeo4j(relationship): crea/actualiza nodo Person
     y arista KNOWS en Neo4j con propiedades: strength, category, 
     last_interaction, created_at
   - syncAllPending(): obtiene relationships con neo4j_sync_status='pending',
     las sincroniza en batch de 50, actualiza status a 'synced'
2. Crea apps/web/src/app/api/neo4j/sync/route.ts:
   - POST protegido (service role) → ejecuta syncAllPending()
   - GET → devuelve stats: total nodos, total aristas, último sync
3. Agrega trigger en /api/relationships/create:
   - Después de insertar en Supabase, llama syncRelationshipToNeo4j()
4. Crea Vercel Cron Job (vercel.json) que llama /api/neo4j/sync 
   cada 6 horas para sincronizar pendientes
5. Commit: feat: neo4j bidirectional sync completo
```
**Verificación:**
- [x] Cliente Neo4j conecta a AuraDB
- [ ] syncRelationshipToNeo4j() crea nodos y aristas en Neo4j
- [ ] Cron job ejecuta sync automático
**Notas:** AuraDB (Neo4j cloud), sync bidireccional Supabase ↔ Neo4j, cliente listo

---

### 15 — Security + Privacy
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Implementa Security & Privacy completo para SIR (GDPR-ready).

1. Data Export:
   - Crea apps/web/src/app/api/privacy/export/route.ts:
     GET → genera ZIP con todos los datos del usuario:
     memorias, señales, relaciones, estados, analytics
   - Página apps/web/src/app/(app)/settings/privacy/page.tsx
     con botón "Exportar mis datos" (descarga ZIP)

2. Data Deletion:
   - Crea apps/web/src/app/api/privacy/delete/route.ts:
     DELETE → elimina todos los datos del usuario (cascade):
     memorias, señales, relaciones, neo4j nodes, embeddings
   - Requiere confirmación con texto "ELIMINAR MI CUENTA"

3. Rate Limiting:
   - Instala @upstash/ratelimit + @upstash/redis
   - Aplica en: /api/signals/capture (10/min), 
     /api/briefing/stream (5/min), /api/human-state (30/min)
   - Retorna 429 con Retry-After header

4. Input Sanitization:
   - Instala zod en apps/web
   - Crea schemas Zod para todos los POST endpoints
   - Reemplaza validaciones manuales con safeParse()

5. Commit: feat: security + privacy (GDPR, rate limiting, zod)
```
**Verificación:**
- [ ] Export genera ZIP con todos los datos
- [ ] Delete elimina todo en cascade
- [ ] Rate limiting bloquea después del límite
- [ ] Zod valida todos los inputs
**Notas:** GDPR compliance, Upstash Redis para rate limiting, Zod para validación

---

### 16 — Executive Mode
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Construye el Executive Mode — vista de alto nivel para usuarios premium.

1. Crea apps/web/src/app/(app)/executive/page.tsx:
   - Vista semanal: top 5 relaciones más activas, 
     tendencia de estado (mood/energy últimos 7 días),
     resumen de señales por categoría (gráfico donut),
     "inbox de oportunidades" ordenado por score
   - Guard: requiere subscription_status = 'pro'

2. Crea apps/web/src/app/api/briefing/executive/route.ts:
   - Genera briefing ejecutivo semanal (más conciso que el diario)
   - Formato: 3 bullets de contexto + 3 acciones prioritarias
   - Usa Claude Sonnet (más inteligente que Haiku) para este modo

3. Crea apps/mobile/src/screens/ExecutiveBriefing.tsx:
   - Vista compacta del briefing ejecutivo
   - Widget para home screen (expo-widgets si disponible)

4. Agrega "Executive" al sidebar web (con badge "PRO")

5. Commit: feat: executive mode para usuarios pro
```
**Verificación:**
- [ ] Página Executive carga con datos reales
- [ ] Guard de subscription funciona (redirige si no es pro)
- [ ] Briefing ejecutivo usa Claude Sonnet
**Notas:** Solo para usuarios pro, Claude Sonnet (no Haiku), vista semanal

---

### 17 — AI Cost Control
**Estado:** ⬜ Pendiente
**Deploy:** —
**Commit:** —
**Prompt usado:**
```
Implementa control de costos AI para evitar sorpresas en facturación.

1. Crea packages/ai/src/cost-tracker.ts:
   - Clase CostTracker con método track(model, inputTokens, outputTokens)
   - Precios hardcodeados: claude-haiku ($0.25/MTok in, $1.25/MTok out),
     claude-sonnet ($3/MTok in, $15/MTok out),
     ollama (gratis, cuenta como $0)
   - Almacena en Supabase tabla: ai_usage (user_id, model, tokens_in,
     tokens_out, cost_usd, created_at)

2. Modifica AIClient en packages/ai:
   - Después de cada llamada, llama CostTracker.track()
   - Si costo acumulado del usuario en el mes > $5: 
     bloquea Claude, fuerza Ollama-only
   - Si Ollama no disponible Y costo > $5: retorna error 402

3. Crea apps/admin/src/app/(app)/costs/page.tsx:
   - Tabla: uso por usuario (tokens in/out, costo total mes)
   - Gráfica: costo diario últimos 30 días
   - Alerta si algún usuario > $3/mes (warning) o > $8 (crítico)

4. Crea apps/web/src/app/api/usage/route.ts:
   - GET → devuelve uso del mes actual del usuario autenticado
   - Widget en settings mostrando tokens usados y costo estimado

5. Commit: feat: AI cost control + usage tracking
```
**Verificación:**
- [ ] CostTracker registra cada llamada AI
- [ ] Bloqueo automático al superar $5/mes
- [ ] Admin dashboard muestra costos por usuario
**Notas:** Precios Claude hardcodeados, umbral $5/mes por usuario, Ollama como fallback gratuito

---

## Infraestructura
| Item | Estado | Notas |
|------|--------|-------|
| GitHub → Vercel auto-deploy | ✅ Activo | push a master → deploy automático |
| sir-web.vercel.app | ✅ Live | Next.js 14, pnpm workspaces |
| sir-admin.vercel.app | ✅ Live | Next.js 14, pnpm workspaces |
| Supabase | ✅ Activo | pgvector, RLS, 8 tablas |
| Neo4j AuraDB | 🔄 Parcial | cliente listo, sync pendiente |

---

## Regla de actualización
Después de cada módulo completado, Claude Code debe:
1. Cambiar estado de ⬜ a ✅ (o 🔄 a ✅)
2. Agregar commit hash y fecha real
3. Marcar checks de verificación como `[x]`
4. Ejecutar:
   ```bash
   git add MASTER_PLAN.md
   git commit -m "docs: update MASTER_PLAN módulo XX"
   git push origin master
   ```
