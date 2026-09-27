export const favoritesTableSql = `
  CREATE TABLE IF NOT EXISTS favorite_split_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    splits_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export const favoritesCreatedAtIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_favorite_split_sets_created_at
  ON favorite_split_sets(created_at)
`;

export const stylePresetsTableSql = `
  CREATE TABLE IF NOT EXISTS style_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    style_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;
