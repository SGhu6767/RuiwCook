-- Migration: adds GitHub login + public profile fields to an existing `users` table.
-- Run once against your D1 database, e.g.:
--   wrangler d1 execute <DB_NAME> --remote --file=schema-profile.sql

ALTER TABLE users ADD COLUMN github_id TEXT;
ALTER TABLE users ADD COLUMN public_id TEXT;
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

-- Existing accounts (created before this migration) get public_id/nickname
-- lazily on their next request — see getUserFromSession() in [[path]].js.
-- No backfill needed here.
