# Guía de deploy — SIR

## 1. Neo4j AuraDB (gratis)

1. Ve a **console.neo4j.io** → Create instance → Free
2. Elige región (misma que tu Supabase para latencia mínima)
3. **Guarda la contraseña** — solo se muestra una vez
4. Copia los datos de conexión:
   - **URI**: `neo4j+s://xxxxxxxx.databases.neo4j.io`
   - **Usuario**: `neo4j`
   - **Contraseña**: la que guardaste

---

## 2. Variables de entorno

### Supabase (dónde encontrar cada valor)

| Variable | Dónde está |
|----------|-----------|
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Settings → API → anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role |
| `SUPABASE_DB_URL` | Settings → Database → Connection string (URI) |

### Anthropic

| Variable | Dónde está |
|----------|-----------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

### Llenar los archivos

```bash
# Edita estos 2 archivos con tus valores reales:
apps/web/.env.local
apps/admin/.env.local
```

---

## 3. Migraciones de base de datos

Una vez que tengas `SUPABASE_DB_URL` en `apps/web/.env.local`:

```bash
# Desde la raíz del monorepo:
SUPABASE_DB_URL="postgres://postgres.[ref]:[pass]@..." npm run migrate
```

Esto crea las tablas `users`, `memories`, `signals` con pgvector y todos los índices.

---

## 4. Deploy en Vercel

### Web (`apps/web`) — puerto 3000 en producción

```bash
# Instala Vercel CLI si no lo tienes
npm install -g vercel

# Deploy desde la carpeta web
cd apps/web
vercel
```

Variables a configurar en el dashboard de Vercel (`apps/web`):
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
```

### Admin (`apps/admin`) — puerto 3001 en producción

```bash
cd apps/admin
vercel
```

Variables a configurar en Vercel (`apps/admin`):
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
```

---

## 5. App mobile (Expo)

Una vez desplegada la web, actualiza `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=https://tu-app.vercel.app
```

Para correr en desarrollo:
```bash
cd apps/mobile
npx expo start
```

Para build de producción con EAS:
```bash
npm install -g eas-cli
eas login
eas build --platform all
```

---

## Verificación rápida

```bash
# Salud del servidor web
curl https://tu-app.vercel.app/api/health

# Debería responder: {"status":"ok","timestamp":"..."}
```

---

## Checklist de deploy

- [ ] Cuenta Neo4j AuraDB creada, URI + password guardados
- [ ] `apps/web/.env.local` completo
- [ ] `apps/admin/.env.local` completo
- [ ] Migraciones ejecutadas (`npm run migrate`)
- [ ] `apps/web` desplegado en Vercel
- [ ] `apps/admin` desplegado en Vercel
- [ ] `apps/mobile/.env` con la URL de producción
