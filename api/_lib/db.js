import pg from "pg";

const { Pool } = pg;

function getGlobalKey(key) {
  if (!globalThis.__sinyalMasasi) globalThis.__sinyalMasasi = {};
  return globalThis.__sinyalMasasi[key];
}

function setGlobalKey(key, value) {
  if (!globalThis.__sinyalMasasi) globalThis.__sinyalMasasi = {};
  globalThis.__sinyalMasasi[key] = value;
  return value;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasDatabase()) throw new Error("DATABASE_URL tanımlı değil");
  const existing = getGlobalKey("pool");
  if (existing) return existing;
  const ssl = process.env.PGSSLMODE === "disable"
    ? false
    : { rejectUnauthorized: false };
  return setGlobalKey("pool", new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
  }));
}

export async function query(text, params = []) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function ensureSchema() {
  if (!hasDatabase()) return false;
  const existing = getGlobalKey("schemaPromise");
  if (existing) return existing;

  const promise = (async () => {
    await query(`
      create table if not exists users (
        id text primary key,
        profile jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await query(`
      create table if not exists user_states (
        user_id text primary key references users(id) on delete cascade,
        state jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await query(`
      create table if not exists market_snapshots (
        kind text not null,
        symbol text not null,
        payload jsonb not null,
        fetched_at timestamptz not null default now(),
        expires_at timestamptz not null,
        source text,
        error text,
        primary key (kind, symbol)
      );
    `);

    await query(`
      create table if not exists job_runs (
        id bigserial primary key,
        job_name text not null,
        status text not null,
        started_at timestamptz not null default now(),
        finished_at timestamptz,
        details jsonb not null default '{}'::jsonb
      );
    `);
  })();

  setGlobalKey("schemaPromise", promise);
  return promise;
}
