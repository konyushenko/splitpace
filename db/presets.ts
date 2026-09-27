import { env } from 'cloudflare:workers';

import { stylePresetsTableSql } from './schema';

type PresetRow = {
  id: string;
  name: string;
  style_json: string;
};

let schemaReady = false;

function database() {
  return (env as unknown as { DB: D1Database }).DB;
}

async function ensureSchema() {
  if (schemaReady) return;
  await database().prepare(stylePresetsTableSql).run();
  schemaReady = true;
}

export async function listPresets() {
  await ensureSchema();
  const result = await database()
    .prepare('SELECT id, name, style_json FROM style_presets ORDER BY created_at ASC')
    .all<PresetRow>();
  return result.results.map((row) => ({ id: row.id, name: row.name, style: JSON.parse(row.style_json) as unknown }));
}

export async function createPreset(name: string, style: unknown) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await database()
    .prepare('INSERT INTO style_presets (id, name, style_json) VALUES (?, ?, ?)')
    .bind(id, name, JSON.stringify(style))
    .run();
  return { id, name, style };
}

export async function updatePreset(id: string, style: unknown) {
  await ensureSchema();
  await database()
    .prepare('UPDATE style_presets SET style_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(JSON.stringify(style), id)
    .run();
}
