import { ensureSchema, hasDatabase, query } from "./db.js";

function normalizeSymbol(symbol) {
  return (symbol || "global").toUpperCase();
}

export async function readSnapshot(kind, symbol = "global") {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const result = await query(
    `select kind, symbol, payload, fetched_at, expires_at, source, error
       from market_snapshots
      where kind = $1 and symbol = $2`,
    [kind, normalizeSymbol(symbol)],
  );
  return result.rows[0] || null;
}

export async function upsertSnapshot(kind, symbol, payload, { ttlSeconds, source = "provider", error = null } = {}) {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const result = await query(
    `insert into market_snapshots (kind, symbol, payload, fetched_at, expires_at, source, error)
     values ($1, $2, $3::jsonb, now(), now() + ($4 || ' seconds')::interval, $5, $6)
     on conflict (kind, symbol)
     do update set
       payload = excluded.payload,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at,
       source = excluded.source,
       error = excluded.error
     returning kind, symbol, payload, fetched_at, expires_at, source, error`,
    [kind, normalizeSymbol(symbol), JSON.stringify(payload), String(ttlSeconds || 300), source, error],
  );
  return result.rows[0] || null;
}

export async function getSnapshotOrRefresh({ kind, symbol = "global", ttlSeconds, fetcher, source = "provider" }) {
  const existing = await readSnapshot(kind, symbol);
  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return { payload: existing.payload, meta: { cached: true, stale: false, fetchedAt: existing.fetched_at, source: existing.source || source } };
  }

  try {
    const payload = await fetcher();
    const saved = await upsertSnapshot(kind, symbol, payload, { ttlSeconds, source, error: null });
    return { payload, meta: { cached: false, stale: false, fetchedAt: saved?.fetched_at || new Date().toISOString(), source } };
  } catch (error) {
    if (existing) {
      return {
        payload: existing.payload,
        meta: {
          cached: true,
          stale: true,
          fetchedAt: existing.fetched_at,
          source: existing.source || source,
          fallbackError: error.message,
        },
      };
    }
    throw error;
  }
}

export async function listTrackedSymbols(defaultSymbols = []) {
  if (!hasDatabase()) return [...defaultSymbols];
  await ensureSchema();
  const result = await query(`select state from user_states where state is not null`);
  const symbols = new Set(defaultSymbols.map((symbol) => normalizeSymbol(symbol)));

  result.rows.forEach((row) => {
    const stocks = row?.state?.stocks;
    if (!Array.isArray(stocks)) return;
    stocks.forEach((stock) => {
      const yahoo = typeof stock?.yahoo === "string" && stock.yahoo.trim()
        ? stock.yahoo.trim()
        : typeof stock?.symbol === "string" && stock.symbol.trim()
          ? `${stock.symbol.trim().toUpperCase()}.IS`
          : null;
      if (yahoo) symbols.add(normalizeSymbol(yahoo));
    });
  });

  return [...symbols];
}

export async function createJobRun(jobName, details = {}) {
  if (!hasDatabase()) return null;
  await ensureSchema();
  const result = await query(
    `insert into job_runs (job_name, status, details)
     values ($1, 'running', $2::jsonb)
     returning id, started_at`,
    [jobName, JSON.stringify(details)],
  );
  return result.rows[0] || null;
}

export async function finishJobRun(id, status, details = {}) {
  if (!hasDatabase() || !id) return null;
  await ensureSchema();
  const result = await query(
    `update job_runs
        set status = $2,
            finished_at = now(),
            details = coalesce(details, '{}'::jsonb) || $3::jsonb
      where id = $1
      returning id, status, started_at, finished_at, details`,
    [id, status, JSON.stringify(details)],
  );
  return result.rows[0] || null;
}

export async function getSystemStatus() {
  if (!hasDatabase()) {
    return {
      database: false,
      snapshots: [],
      jobs: [],
    };
  }

  await ensureSchema();
  const [snapshots, jobs] = await Promise.all([
    query(`
      select kind, symbol, fetched_at, expires_at, source, error
        from market_snapshots
       order by fetched_at desc
       limit 25
    `),
    query(`
      select id, job_name, status, started_at, finished_at, details
        from job_runs
       order by started_at desc
       limit 10
    `),
  ]);

  return {
    database: true,
    snapshots: snapshots.rows,
    jobs: jobs.rows,
  };
}
