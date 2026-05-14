#!/usr/bin/env npx ts-node
/**
 * Ejecuta las migraciones SQL de Supabase en orden.
 * Uso: npx ts-node scripts/migrate.ts
 *
 * Requiere: SUPABASE_DB_URL en el entorno
 * Formato:  postgres://postgres.[project-ref]:[password]@[host]:5432/postgres
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DB_URL = process.env['SUPABASE_DB_URL'];

if (!DB_URL) {
  console.error('\n✗  Falta SUPABASE_DB_URL en el entorno.');
  console.error('   Encuéntrala en: Supabase → Settings → Database → Connection string (URI)\n');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function run() {
  // Importar postgres dinámicamente para evitar error en CI sin la dep
  let sql: Awaited<ReturnType<typeof import('postgres')['default']>>;
  try {
    const postgres = (await import('postgres')).default;
    sql = postgres(DB_URL!, { ssl: 'require' });
  } catch {
    console.error('\n✗  Instala la dependencia primero: npm install -D postgres\n');
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`\n▶  Ejecutando ${files.length} migraciones...\n`);

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      await sql.unsafe(content);
      console.log(`  ✓  ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignorar errores de "ya existe" — idempotente
      if (msg.includes('already exists')) {
        console.log(`  ↩  ${file} (ya aplicada)`);
      } else {
        console.error(`  ✗  ${file}: ${msg}`);
        await sql.end();
        process.exit(1);
      }
    }
  }

  await sql.end();
  console.log('\n✓  Migraciones completadas.\n');
}

run();
