import pg from "pg";

const { Pool } = pg;

const REQUIRED_TABLES = ["users", "user_states", "market_snapshots", "job_runs"];

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

function getSslMode() {
  return String(process.env.PGSSLMODE || "require").trim().toLowerCase();
}

function getSslConfig() {
  const sslMode = getSslMode();
  if (sslMode === "disable") return false;
  if (sslMode === "verify-full") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

function parseConnectionString() {
  if (!hasDatabase()) return null;
  try {
    return new URL(process.env.DATABASE_URL);
  } catch {
    return null;
  }
}

function inferProvider(hostname = "") {
  const host = hostname.toLowerCase();
  if (!host) return "unknown";
  if (host === "neon.tech" || host.endsWith(".neon.tech")) return "neon";
  if (host === "supabase.co" || host.endsWith(".supabase.co")) return "supabase";
  if (host === "vercel-storage.com" || host.endsWith(".vercel-storage.com")) return "vercel-postgres";
  if (host === "render.com" || host.endsWith(".render.com")) return "render";
  if (host === "railway.app" || host.endsWith(".railway.app")) return "railway";
  return "custom";
}

export function getDatabaseConfigSummary() {
  const parsed = parseConnectionString();
  return {
    configured: hasDatabase(),
    provider: inferProvider(parsed?.hostname),
    host: parsed?.hostname || null,
    database: parsed?.pathname?.replace(/^\//, "") || null,
    sslMode: hasDatabase() ? getSslMode() : null,
  };
}

export function getPool() {
  if (!hasDatabase()) throw new Error("DATABASE_URL tanımlı değil");
  const existing = getGlobalKey("pool");
  if (existing) return existing;
  return setGlobalKey("pool", new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getSslConfig(),
    max: Number(process.env.PG_MAX_CONNECTIONS || 3),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10_000),
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

export async function getDatabaseHealth() {
  const config = getDatabaseConfigSummary();
  if (!config.configured) {
    return {
      ...config,
      connected: false,
      schemaReady: false,
      tables: [],
      missingTables: REQUIRED_TABLES,
      error: "DATABASE_URL tanımlı değil",
    };
  }

  try {
    await ensureSchema();
    const [connectionInfo, tablesResult] = await Promise.all([
      query(`select current_database() as database, now() as checked_at`),
      query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
           and table_name = any($1::text[])
         order by table_name asc
      `, [REQUIRED_TABLES]),
    ]);

    const tables = tablesResult.rows.map((row) => row.table_name);
    const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));

    return {
      ...config,
      database: connectionInfo.rows[0]?.database || config.database,
      checkedAt: connectionInfo.rows[0]?.checked_at || new Date().toISOString(),
      connected: true,
      schemaReady: missingTables.length === 0,
      tables,
      missingTables,
      error: null,
    };
  } catch (error) {
    return {
      ...config,
      connected: false,
      schemaReady: false,
      tables: [],
      missingTables: REQUIRED_TABLES,
      error: error.message,
    };
  }
}
