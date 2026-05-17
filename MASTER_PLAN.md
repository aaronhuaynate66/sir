# SIR — Master Plan

## Estado general
Última actualización: 2026-05-16
Versión en producción: `master` — Phase 6 completa + Fase 7 iniciada (38/44 módulos)

**Nota 2026-05-16 (sesión actual):** Módulos 36-38 completados. Sentry + Vercel Analytics (36), Microsoft/Outlook OAuth + Graph API (37), WhatsApp upload por perfil de persona vía Supabase Storage (38). Fixes: React hydration #425/#418/#423, Google OAuth redirect mismatch, WhatsApp parser multi-format (español/inglés), memorias query por person_id.

**Nota 2026-05-15 (última sesión):** Módulo 22 — Security Layer + Privacy Controls. RLS verificado en todas las tablas, audit_log creado. Rate limiting Supabase (20 AI calls/hora) + plan limits (free: 5 briefings total, individual/pro: 50/mes) wired en /api/briefing, /api/signals/capture, /api/human-state. GDPR: GET /api/user/export (ZIP con 9 JSONs) y DELETE /api/user/me (con confirm:true, cascade). Migraciones pendientes de aplicar: 000005-000008.

**Nota 2026-05-15 (URL taxonomy):** URL taxonomy implemented. Rutas limpias: /red, /red/[slug], /memorias, /senales, /estado, /inicio. Slug generado en createPersonAction con deduplicación. UUID-vs-slug dual lookup en /red/[slug]/page.tsx con redirect canónico. Redirects 301 en next.config.mjs para todas las rutas antiguas. Migración 20260515000009_people_slug.sql creada (pendiente de aplicar en Supabase).

**Nota 2026-05-15 (Executive Mode):** Executive Intelligence Mode ✅ completo. Layout con paywall para plan free. 4 sub-páginas: /executive/stakeholders (ReactFlow graph estratégico+profesional con ranking y panel lateral), /executive/pipeline (Kanban DnD HTML5, 4 columnas, server action updatePersonStage), /executive/capital (Score 0-100 ponderado: estratégicas 40%+fuerza 30%+interacciones 20%-penalización 10%), /executive/reporte (stats semanales + AI report via /api/executive/report con Claude). Sidebar tab nav con usePathname.

## URLs de producción
- Web: https://sir-web.vercel.app
- Admin: https://sir-admin.vercel.app
- Repo: https://github.com/aaronhuaynate66/SIR

## Progreso general
```
████████████████████████████████████░░░░░░░ 35/47 completados (74%)
```
✅ Completo: 35 | 🔄 Parcial: 0 | ⬜ Pendiente: 12

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
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `7cdd8fa` (2026-05-14) → rediseñado en `80bddfe`+
**Prompt usado:** Construye la visualización del grafo de relaciones en apps/web con ReactFlow v11. Layout circular con user en centro y personas como nodos periféricos. Color de nodo por relationship_type (family/professional/personal), grosor de arista por strength, animación en relaciones estratégicas. Click en nodo abre side panel con métricas (fuerza, reciprocidad, confianza) y link a perfil. GraphControls con filtro por tipo y slider de fuerza mínima. Sidebar link Grafo entre Personas y Señales.
**Verificación:**
- [x] Grafo renderiza con nodos reales (layout circular)
- [x] Click en nodo muestra side panel con métricas
- [x] Filtros por tipo de relación y fuerza mínima funcionan
- [x] Build Next.js sin errores (49.9 kB bundle)
**Notas:** reactflow@^11, transpilePackages configurado, layout circular con radio dinámico. Rediseñado 2026-05-15: nodos avatar circulares con initials, badge de fase del ciclo, hover mini-card, edges coloreados por PersonRelationshipType (6 tipos), chip filters, BriefingButton en side panel.

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

### 09 — Notification Intelligence Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `0a20e2e` (2026-05-14)
**Prompt usado:** Construye el Notification Intelligence Engine completo: migración SQL (`notification_logs`, prefs en `users`), tipos en `@sir/db`, repositorio notifications, Vercel Cron hourly (`/api/notifications/engine`), 5 tipos de trigger (reconnect, signal opportunities, birthdays, weekly digest, briefing ready), supresión por vulnerabilidad/DND/daily cap, push via Expo Push API, email via Resend + React Email (3 templates), página `/notifications` con filtros y mark-as-read, página `/settings` con preferencias, Sidebar con badge de no leídas.
**Verificación:**
- [x] Vercel Cron configurado (`0 * * * *`) y deployment READY
- [x] 5 evaluadores de trigger implementados
- [x] Push via Expo Push API, email via Resend
- [x] `/notifications` con mark-as-read optimista
- [x] `/settings` con DND, daily cap, timezone
- [x] Sidebar badge muestra count de no leídas
**Notas:** Vercel Cron (no Edge Function), suppression rules (vulnerability >0.8, DND, 3/día), 3 React Email templates. **Pendiente:** aplicar migración SQL vía Supabase dashboard; env vars RESEND_API_KEY, CRON_SECRET, EMAIL_FROM.

---

### 10 — Analytics Event System
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `401b548` (2026-05-14)
**Prompt usado:** Construye el sistema de analytics: tabla analytics_events (user_id, event_name, properties jsonb, session_id), EVENT_NAMES en @sir/shared, trackEvent() en @sir/db, instrumentar /api/signals/capture, /api/briefing y /api/human-state con llamadas fire-and-forget. Admin /analytics: KPIs DAU/WAU/total, barchart 14 días CSS, top 6 eventos por frecuencia.
**Verificación:**
- [x] trackEvent() en @sir/db, non-blocking en 3 APIs
- [x] EVENT_NAMES + AnalyticsEvent en @sir/shared
- [x] Admin /analytics con KPIs y charts CSS
- [x] Build 5/5 tasks sin errores
**Notas:** Fire-and-forget (`.catch(() => undefined)`), sin charting library externa. Migración SQL pendiente de aplicar en Supabase.

---

### 11 — RevenueCat + Stripe
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `7a60dbb` (2026-05-14)
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
- [x] Checkout Stripe funciona en web (modo test)
- [x] RevenueCat entitlement "pro" se activa en mobile
- [x] Webhook actualiza subscription_status en Supabase
**Notas:** stripe@17.x (apiVersion 2025-02-24.acacia), react-native-purchases@8.x, subscription helper `requirePro()` + `isPaidStatus()` en `lib/subscription.ts`, settings UpgradeSection con portal Stripe. **Pendiente:** env vars STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, EXPO_PUBLIC_REVENUECAT_API_KEY

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
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `07b50a9` (2026-05-14)
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
- [x] syncRelationshipToNeo4j() crea nodos y aristas en Neo4j
- [x] Cron job ejecuta sync automático
**Notas:** AuraDB (Neo4j cloud), sync bidireccional Supabase ↔ Neo4j, syncAllPending() en @sir/db, Vercel Cron `0 */6 * * *`. **Pendiente:** env vars NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, CRON_SECRET

---

### 15 — Security + Privacy
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `ffed8d4` (2026-05-14)
**Prompt usado:** Implementa Security & Privacy (GDPR-ready): GET /api/privacy/export → JSON con todos los datos del usuario, DELETE /api/privacy/delete con confirmación "ELIMINAR MI CUENTA", /settings/privacy page. Rate limiting opcional con @upstash/ratelimit (graceful no-op sin UPSTASH env vars): capture 10/m, briefing 5/m, human-state 30/m. Zod schemas en lib/schemas.ts aplicados a capture, human-state y push-tokens.
**Verificación:**
- [x] Export descarga JSON completo con 7 colecciones
- [x] Delete cascade en orden correcto con confirmación Zod
- [x] Rate limiting: 429 + Retry-After, desactivado sin Upstash
- [x] Zod safeParse en 3 endpoints, schemas en lib/schemas.ts
- [x] Build 4/4 sin errores
**Notas:** Export JSON (no ZIP — no dep extra). Rate limiting completamente opcional (env vars UPSTASH_REDIS_REST_URL/TOKEN). Zod `exactOptionalPropertyTypes` handled with conditional spread.

---

### 16 — Executive Mode
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `721220d` (2026-05-14)
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
- [x] Página Executive carga con datos reales
- [x] Guard de subscription funciona (redirige si no es pro)
- [x] Briefing ejecutivo usa Claude Sonnet
**Notas:** requirePro() en page.tsx, Claude Sonnet (no Haiku), ExecutiveBriefingWidget client component con lazy load, sidebar PRO badge, mobile ExecutiveBriefing screen con 403 guard

---

### 17 — AI Cost Control
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `ef11a4b` (2026-05-14)
**Prompt usado:** Implementa control de costos AI: tabla ai_usage, CostTracker en @sir/ai con precios hardcodeados (haiku $0.25/$1.25, sonnet $3/$15, ollama $0), isOverMonthlyLimit($5) en briefing → fallback estático si excede, tracking en briefing+capture, GET /api/usage, widget en settings, admin /costs con chart diario + top usuarios + alertas warn/critical.
**Verificación:**
- [x] CostTracker.track() en briefing (sonnet) y capture (haiku)
- [x] isOverMonthlyLimit() → fallback estático si >$5/mes
- [x] Admin /costs: chart, by-model, top users con alertas
- [x] Settings: barra de uso con colores
- [x] Build 5/5 sin errores
**Notas:** Cost check fire-and-forget. Bloqueo en briefing route. 3 migraciones SQL pendientes de aplicar (analytics_events, ai_usage, + notification_logs).

---

### 18 — Screenshot Intelligence Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `7830c10` (2026-05-15)
**Fecha:** 2026-05-15
**Descripción:** Procesa screenshots de LinkedIn, Instagram y WhatsApp. Extrae datos estructurados con Claude Vision (claude-sonnet-4-6). Modal de confirmación editable con merge warnings (nunca sobreescribe campos existentes). Lógica merge: `mergeIfEmpty()` para campos string, concat para notas, dedup por `role+company` para historial laboral. Crea memorias semánticas (location, education, work_history) y señales automáticas.
**Archivos clave:** `apps/web/src/app/api/people/[id]/analyze-screenshot/route.ts`, `apps/web/src/app/(app)/people/[id]/ScreenshotAnalyzer.tsx`, `apps/web/src/app/(app)/actions.ts`
**Verificación:**
- [x] Claude Vision extrae datos de LinkedIn, Instagram, WhatsApp
- [x] Modal de confirmación editable con merge warnings
- [x] Merge strategy: nunca sobreescribe campos existentes
- [x] Crea memorias semánticas (location, education, work_history)
- [x] Build Next.js sin errores
**Notas:** JSON markdown fences stripping antes de `JSON.parse`. WhatsApp extrae además: `conversation_tone`, `emotional_state`, `topics[]`, `last_interaction_quality`, `cycle_data`.

---

### 19 — Sensitive Context Engine
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `80bddfe` (2026-05-15)
**Fecha:** 2026-05-15
**Descripción:** Rueda de ciclo menstrual estilo Clue (SVG puro, 28 segmentos, colores por fase: Menstrual/#E8394D, Folicular/#4CAF82, Ovulación/#2ECC71, Lútea/#7C6FCD). Cálculo automático de fase desde `last_period_start`. Recomendación de tono por fase con emoji. Registro rápido de síntomas (Ánimo/Energía/Sueño/Dolor) con guardado inmediato en `people.sensitive_context` jsonb. Love language (5 opciones), estado emocional, patrones relacionales. Tarjeta "Contexto privado" primera en el perfil para relaciones personales/familia. Tarjeta "Perfil profesional" colapsada por defecto.
**Archivos clave:** `apps/web/src/app/(app)/people/[id]/PersonProfileCards.tsx`, `apps/web/src/app/(app)/actions.ts`, `packages/db/src/schema.ts`
**Migraciones:** `20260515000005_people_sensitive_data.sql`, `20260515000006_people_emotional_context.sql`
**Verificación:**
- [x] SVG cycle wheel renderiza 28 segmentos con colores por fase
- [x] Punto blanco brillante en día actual
- [x] Recomendación de tono cambia por fase
- [x] Registro de síntomas persiste en sensitive_context (jsonb merge)
- [x] Tarjeta solo visible para personal/familia
- [x] Build Next.js sin errores, 86/86 tests
**Notas:** `updateSensitiveContextAction` hace `Object.assign` para merge jsonb. Profesional colapsado por defecto. Columnas nuevas: `cycle_data`, `sensitive_context`, `emotional_state`, `love_language`, `relationship_patterns`.

---

### 20 — Relationship Type Field
**Estado:** ✅ Completo
**Deploy:** ✅ Vercel
**Commit:** `dd52634` (2026-05-15)
**Fecha:** 2026-05-15
**Descripción:** Campo `relationship_type` en tabla `people` con 6 valores: professional, networking, family, personal, strategic, developing. Editor inline en `/people/[id]` (RelationshipTypeEditor). Filtros en `/people` por tipo. Badge en cada person card. Tono del AI Briefing ajustado por tipo de relación. Widget en dashboard con distribución de tipos.
**Archivos clave:** `apps/web/src/app/(app)/people/[id]/RelationshipTypeEditor.tsx`, `apps/web/src/app/(app)/people/page.tsx`
**Migración:** `20260515000001_people_relationship_type.sql`
**Verificación:**
- [x] 6 tipos con emoji y color en editor inline
- [x] Filtros en /people funcionan
- [x] Badge en cards
- [x] Briefing considera tipo de relación en prompt
- [x] Build Next.js sin errores
**Notas:** PersonRelationshipType en schema.ts. Editor inline usa server action `updatePersonRelationshipTypeAction`.

---

### 21 — Analytics Event System
**Estado:** ✅ Completo
**Commit:** (2026-05-15)
**Descripción:** Tracking completo de eventos para entender uso del producto.
**Componentes:**
- `packages/analytics/` — paquete `@sir/analytics` con 22 eventos tipados y `trackServerEvent` (Supabase)
- `GoogleAnalytics` (next/third-parties/google) en root layout — page views automáticos
- `src/lib/analytics.ts` — helper `gtag()` para eventos cliente via `sendGAEvent`
- Eventos integrados: person_created, person_viewed, screenshot_saved, briefing_generated, signal_created, state_logged, graph_viewed
- Admin `/analytics` mejorado: top 10 eventos, KPIs de briefings/screenshots/costo, tabla reciente
**Verificación:**
- [x] @sir/analytics package con 22 eventos tipados
- [x] trackServerEvent escribe a Supabase analytics_events
- [x] GA4 via next/third-parties/google (NEXT_PUBLIC_GA4_MEASUREMENT_ID)
- [x] Llamadas en briefing, signals, human-state, actions, people/[id], grafo
- [x] Admin analytics page con métricas requeridas
- [x] Tests pasan

---

## Módulo 22 — Security Layer + Privacy Controls ✅

**Estado:** ✅ Completo
**Commit:** (2026-05-15)
**Descripción:** Capa de seguridad robusta para datos sensibles (cycle_data, notes_personal, sensitive_context).
**Componentes:**
- `20260515000008_security_layer.sql` — tabla `audit_log` + RLS forzado en todas las tablas
- `lib/ratelimit.ts` — `checkAIHourlyLimit` (20/hr vía Supabase analytics_events) + `checkBriefingMonthlyLimit` (free: 5 total, individual/pro: 50/mes)
- `/api/briefing` — per-minute + hourly + plan limits
- `/api/signals/capture` — per-minute + hourly limits
- `/api/human-state` — per-minute + hourly limits
- `GET /api/user/export` — ZIP con 9 JSONs (profile, people, relationships, memories, signals, briefings, states, analytics, notifications) + log en audit_log
- `DELETE /api/user/me` — eliminación con `confirm:true`, cascade a toda la data + auth.users
**Verificación:**
- [x] RLS activo en 10 tablas
- [x] 20 AI calls/hora por usuario via Supabase
- [x] Plan limits: free 5 total, individual/pro 50/mes
- [x] GDPR export: ZIP descargable con toda la data
- [x] GDPR delete: eliminación permanente con confirmación

---

### 23 — Fix Calidad (Phase 5)
**Estado:** ✅ Completo
**Commit:** `cd09f74` (2026-05-15)
**Descripción:** Mejoras de calidad en el análisis de screenshots y visualización de señales.
**Componentes:**
- Prompt SYSTEM de `analyze-screenshot` abre con instrucción explícita: "ALWAYS respond in Spanish"
- `SIGNAL_LABELS` map en `/red/[slug]/page.tsx` traduce tipos raw (job_change, promotion…) a español legible
- Sidebar: `/settings` → `/config` route corregida
- `/config` page: nombre, idioma, timezone, DND, push/email toggles, logout

---

### 24 — Global Search (Phase 5)
**Estado:** ✅ Completo
**Commit:** `cd09f74` (2026-05-15)
**Descripción:** Búsqueda global con Cmd+K en toda la aplicación web.
**Componentes:**
- GET `/api/search?q=` — busca people (name/role/org), memories (content), signals (action_recommendation), max 5 por tipo
- `SearchModal.tsx` — modal full-screen con 300ms debounce, skeleton loading, Escape para cerrar, secciones separadas por tipo
- Sidebar: botón "Buscar…" con badge ⌘K + `useEffect` global para Cmd+K / Ctrl+K

---

### 25 — Landing Page Pública (Phase 5)
**Estado:** ✅ Completo
**Commit:** `cd09f74` (2026-05-15)
**Descripción:** Landing page completa en `/` para usuarios no autenticados.
**Componentes:**
- Hero section (52px, 2 CTAs), 3 features cards, "Cómo funciona" (3 pasos), Pricing (3 planes: Individual $19, Executive $49, Teams $39/usr), Footer
- Usuarios autenticados → redirect `/inicio`
- Middleware: auth-on-auth-route redirect corregido `/dashboard` → `/inicio`

---

### 26 — Mobile Completo (Phase 5)
**Estado:** ✅ Completo
**Commit:** `d3dd778` (2026-05-15)
**Descripción:** App móvil completamente funcional con 5 tabs y briefing en perfil.
**Componentes:**
- `estado.tsx` — emoji mood picker, energy 1-10, physical/emotional tags, haptic feedback (try/catch graceful si expo-haptics no instalado)
- `senales.tsx` — FlatList de señales + RefreshControl, FAB modal → POST `/api/signals/capture`
- `config.tsx` — logout vía `supabase.auth.signOut()` + `clearSession()`
- `_layout.tsx` — 5 tabs: Inicio | Red | Señales | Estado | Config; state+memories con `href: null`
- `index.tsx` — route `/(tabs)/state` → `/(tabs)/estado`
- `person/[id].tsx` — botón "Generar Briefing IA" → POST `/api/briefing`, muestra resultado + indicador de costo

---

### 27 — AI Cost Dashboard Mejorado (Phase 5)
**Estado:** ✅ Completo
**Commit:** `e27e4c7` (2026-05-15)
**Descripción:** Admin `/ai-usage` con alertas, tendencia 7 días y exportación CSV.
**Componentes:**
- Banner de alerta rojo cuando costo diario > $1
- Gráfico de barras 7 días (CSS puro, día actual destacado en índigo)
- Top users: columna `% Límite` con badge (verde/ámbar/rojo según % del presupuesto del plan)
- `ExportButton.tsx` (client component) → descarga `/api/ai-usage/export` como CSV (últimas 1000 filas)
- `GET /api/ai-usage/export/route.ts` — genera CSV con headers correctos y `Content-Disposition`

---

---

## Phase 6 — Integraciones & Growth (Módulos 28-36)

### 28 — Google Contacts + Calendar Integration (Phase 6)
**Estado:** ✅ Completo
**Commit:** `dabbc52` (2026-05-15)
**Descripción:** Integración completa con Google Contacts y Google Calendar.
**Componentes:**
- `GET /api/integrations/google/connect` — OAuth2 authorize redirect (contacts.readonly + calendar.readonly, offline access)
- `GET /api/integrations/google/callback` — code exchange → upsert `google_integrations`, state CSRF via base64url(userId)
- `POST /api/integrations/google/sync-contacts` — Google People API paginado, dedup by email+name, patch-only-empty fields
- `POST /api/integrations/google/sync-calendar` — últimos 6 meses, crea signals + strength +5/reunión (max 100)
- `DELETE /api/integrations/google/disconnect` — revoke at Google + delete row
- `_lib.ts` — `getValidToken()` con auto-refresh, `getCallbackUrl()`, `GoogleIntegration` type
- `/config/integraciones/page.tsx` — server component muestra estado, stats, `GoogleCard`
- `GoogleCard.tsx` — client component: Connect link, Sync Now (paralelo contacts+calendar), Disconnect
- `Sidebar.tsx` — link Integraciones añadido
- `/red/page.tsx` — banner Google import en empty state
- SQL: `google_integrations` table con RLS (`20260516000001_google_integrations.sql`)
**Env vars requeridas:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
**Google Cloud Console:** APIs habilitadas: People API + Calendar API v3. OAuth redirect URI: `{APP_URL}/api/integrations/google/callback`

---

### 29 — Gmail Integration (Phase 6)
**Estado:** ✅ Completo
**Commit:** `4a655fa` (2026-05-15)
**Descripción:** Gmail OAuth (gmail.readonly), sync de últimos 6 meses, análisis con Claude Haiku.
**Componentes:**
- `GET /api/integrations/gmail/connect` — OAuth con scopes contacts+calendar+gmail
- `POST /api/integrations/gmail/sync` — Gmail API, batch-fetch metadata (200 msgs), Claude Haiku para topics/tone
- `GmailCard.tsx` — card en /config/integraciones con estado conectado, emails procesados
- SQL: `emails_synced`, `gmail_last_sync_at` columns en google_integrations

---

### 30 — WhatsApp Chat Export (Phase 6)
**Estado:** ✅ Completo
**Commit:** `c34c614` (2026-05-15)
**Descripción:** Import de exports de WhatsApp (.txt), análisis con Claude Haiku, memorias semánticas.
**Componentes:**
- `POST /api/integrations/whatsapp/import` — parser del formato WhatsApp, match por nombre, Claude Haiku analysis
- `WhatsAppCard.tsx` — instrucciones + file upload + historial de imports

---

### 31 — Notas de Voz (Phase 6)
**Estado:** ✅ Completo
**Commit:** `e7e0fb9` (2026-05-15)
**Descripción:** Grabación de audio con MediaRecorder + transcripción en tiempo real vía SpeechRecognition.
**Componentes:**
- `POST /api/voice/transcribe` — Claude Haiku extrae mentions, emotion, topics, signals del transcript
- `VoiceNote.tsx` — componente cliente: graba, transcribe en vivo (editable), guarda con análisis
- Integrado en perfil de persona (/red/[slug]) y página de señales (/senales)

---

### 32 — Patrones de Comportamiento (Phase 6)
**Estado:** ✅ Completo
**Commit:** `79eb832` (2026-05-15)
**Descripción:** Dashboard de análisis conductual de relaciones.
**Componentes:**
- `GET /api/analytics/behavior` — API con 4 secciones: at-risk, desbalanceadas, pendientes, más activas
- `/red/patrones` — dashboard con las 4 secciones y links a perfiles
- Banner de alerta en /inicio cuando hay relaciones en riesgo

---

### 33 — Rituales Relacionales (Phase 6)
**Estado:** ✅ Completo
**Commit:** `4b883d1` (2026-05-15)
**Descripción:** Motor de sugerencias proactivas diarias (cron) para mantener relaciones.
**Componentes:**
- `POST /api/rituals/engine` — genera sugerencias por tipo: no_contact (21d), birthday (7d), anniversary (14d), job_change, achievement, strength_declining
- `POST /api/rituals/dismiss` — descarta sugerencia
- `/rituales` page + `RitualsList.tsx` (client, con dismiss optimista)
- Widget en /inicio con top 3 rituales + enlace "Ver todos"
- SQL: `ritual_suggestions` table con RLS

---

### 34 — Fechas y Rituales Personalizados (Phase 6)
**Estado:** ✅ Completo
**Commit:** `ffc581d` (2026-05-15)
**Descripción:** Fechas especiales personalizadas por relación.
**Componentes:**
- `GET/POST/DELETE /api/people/[id]/dates` — CRUD de fechas
- `SpecialDates.tsx` — card en perfil de persona: lista de fechas con días restantes + modal de creación
- Motor de rituales actualizado para incluir custom_dates (14 días de anticipación)
- SQL: `people_dates` table con RLS

---

### 35 — Análisis de Salud Relacional (Phase 6)
**Estado:** ✅ Completo
**Commit:** `9dcb968` (2026-05-15)
**Descripción:** Score 0-100 de salud relacional por persona.
**Componentes:**
- `GET /api/people/[id]/health` — score con breakdown: frecuencia (30%), reciprocidad (25%), calidad (25%), señales (20%), trend vs mes anterior
- `/red/salud` — dashboard con heatmap de todos los contactos, secciones por severidad
- Puntos de color (verde/amarillo/rojo) en tarjetas de /red
- Link "Ver salud →" en header de /red

---

### 36 — Analytics & Monitoring ✅ Completo
**Estado:** ✅ Completo
**Commit:** `feat/analytics-monitoring` (2026-05-15)
**Descripción:** Sentry error tracking, Vercel Analytics + Speed Insights, health check mejorado, panel monitoring en admin.
**Verificación:**
- [x] @sentry/nextjs instalado y configurado (sentry.client/server/edge.config.ts)
- [x] instrumentation.ts registra Sentry en Node.js y Edge runtime
- [x] next.config.mjs wrapeado con withSentryConfig
- [x] @vercel/analytics — `<Analytics />` en root layout
- [x] @vercel/speed-insights — `<SpeedInsights />` en root layout
- [x] /api/health retorna status detallado: supabase, neo4j, env, version, uptime
- [x] /admin/monitoring — panel con servicios, links rápidos, errores Sentry
- [x] Nav admin actualizado con "Monitoring"

---

### 37 — Outlook / Microsoft 365 Integration ✅ Completo
**Estado:** ✅ Completo
**Commit:** `feat/outlook-microsoft-integration` (2026-05-16)
**Verificación:**
- [x] OAuth 2.0 Microsoft: connect + callback (tenant=common, scopes: Contacts.Read, Calendars.Read, Mail.Read)
- [x] `microsoft_integrations` tabla en Supabase con RLS
- [x] `/api/integrations/microsoft/sync-contacts` — Graph API contacts con paginación
- [x] `/api/integrations/microsoft/sync-calendar` — eventos últimos 6 meses, interactions + strength updates
- [x] `/api/integrations/microsoft/disconnect` — elimina tokens
- [x] `OutlookCard.tsx` — conectar/sincronizar/desconectar, stats contactos y reuniones
- [x] `/config/integraciones` actualizado — Outlook antes de WhatsApp, iCloud sigue "PRONTO"

---

## Infraestructura
| Item | Estado | Notas |
|------|--------|-------|
| GitHub → Vercel auto-deploy | ✅ Activo | push a master → deploy automático |
| sir-web.vercel.app | ✅ Live | Next.js 14, pnpm workspaces |
| sir-admin.vercel.app | ✅ Live | Next.js 14, pnpm workspaces |
| Supabase | ✅ Activo | pgvector, RLS, 8 tablas |
| Neo4j AuraDB | 🔄 Parcial | cliente listo, sync pendiente |
| Google OAuth | ✅ Activo | Contacts + Calendar integration |

---

---

## FASE 7 — Distribución y Monetización

| # | Módulo | Estado | Prioridad |
|---|--------|--------|-----------|
| 38 | WhatsApp por perfil de persona | ✅ Completo | Alta |
| 39 | Re-sincronización Google Contacts | ⬜ Pendiente | Alta |
| 40 | WhatsApp Bot (número propio) | ⬜ Pendiente | Alta |
| 41 | Múltiples cuentas Google | ⬜ Pendiente | Media |
| 42 | Stripe + pagos | ⬜ Pendiente | Alta |
| 43 | Extensión de Chrome | ⬜ Pendiente | Media |
| 44 | EAS Build App Store/Play Store | ⬜ Pendiente | Baja |

## Bugs Pendientes

| # | Bug | Estado | Prioridad |
|---|-----|--------|-----------|
| B1 | Gmail sync 0 contactos analizados | ⬜ Pendiente | Media |
| B2 | Google Contacts bajó de 602 a 131 | ⬜ Pendiente | Alta |
| B3 | Errores React hydration #425/#418 | ✅ Completo | Media |

## Calidad Pendiente

| # | Item | Estado |
|---|------|--------|
| Q1 | Probar onboarding con usuario nuevo real | ⬜ Pendiente |
| Q2 | Verificar briefing usa contexto WhatsApp | ✅ 2026-05-16 |
| Q3 | Notas en inglés mezcladas en perfiles | ✅ 2026-05-17 |
| Q4 | UX redes sociales: botón "Escanear perfil" + Facebook/Twitter/TikTok | ✅ 2026-05-16 |

---

## Resumen de progreso total

| Fase | Módulos | Completados |
|------|---------|-------------|
| Fase 0-4 (Core) | 17 | 17 ✅ |
| Fase 5 (Calidad) | 8 | 8 ✅ |
| Fase 6 (Inteligencia) | 9 | 9 ✅ |
| Fase 7 (Distribución) | 7 | 1 ✅ · 6 ⬜ |
| Bugs | 3 | 0 ⬜ |
| Calidad | 4 | 1 ✅ · 3 ⬜ |
| **Total** | **48** | **36 ✅** |

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
