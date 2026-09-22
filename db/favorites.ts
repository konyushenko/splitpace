import { env } from 'cloudflare:workers';

import { favoritesCreatedAtIndexSql, favoritesTableSql } from './schema';

type Split = { id: number; km: string; pace: string };

type FavoriteRow = {
  id: string;
  name: string;
  splits_json: string;
};

let schemaReady = false;

function database() {
  return (env as unknown as { DB: D1Database }).DB;
}

async function ensureSchema() {
  if (schemaReady) return;
  const db = database();
  await db.batch([
    db.prepare(favoritesTableSql),
    db.prepare(favoritesCreatedAtIndexSql),
  ]);
  schemaReady = true;
}

function toFavorite(row: FavoriteRow) {
  return {
    id: row.id,
    name: row.name,
    splits: JSON.parse(row.splits_json) as Split[],
  };
}

export async function listFavorites() {
  await ensureSchema();
  const result = await database()
    .prepare('SELECT id, name, splits_json FROM favorite_split_sets ORDER BY created_at ASC')
    .all<FavoriteRow>();
  return result.results.map(toFavorite);
}

export async function createFavorite(name: string, splits: Split[]) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await database()
    .prepare('INSERT INTO favorite_split_sets (id, name, splits_json) VALUES (?, ?, ?)')
    .bind(id, name, JSON.stringify(splits))
    .run();
  return { id, name, splits };
}

export async function updateFavorite(id: string, name: string, splits: Split[]) {
  await ensureSchema();
  await database()
    .prepare('UPDATE favorite_split_sets SET name = ?, splits_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(name, JSON.stringify(splits), id)
    .run();
  return { id, name, splits };
}
