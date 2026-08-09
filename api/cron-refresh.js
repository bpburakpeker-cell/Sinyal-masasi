import { DEFAULT_TRACKED_SYMBOLS, SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchCompanyPayload, fetchFxPayload, fetchMarketPayload, fetchNewsPayload, fetchQuotePayload } from "./_lib/providers.js";
import { createJobRun, finishJobRun, listTrackedSymbols, upsertSnapshot } from "./_lib/snapshots.js";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query?.secret;
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function refreshSymbol(kind, symbol) {
  switch (kind) {
    case "quote":
      return upsertSnapshot(kind, symbol, await fetchQuotePayload(symbol), { ttlSeconds: SNAPSHOT_TTLS.quote, source: "cron" });
    case "news":
      return upsertSnapshot(kind, symbol, await fetchNewsPayload(symbol), { ttlSeconds: SNAPSHOT_TTLS.news, source: "cron" });
    case "company":
      return upsertSnapshot(kind, symbol, await fetchCompanyPayload(symbol), { ttlSeconds: SNAPSHOT_TTLS.company, source: "cron" });
    default:
      throw new Error(`Bilinmeyen sembol işi: ${kind}`);
  }
}

async function runJob(job, symbols) {
  const refreshed = [];

  if (job === "fast" || job === "full") {
    await Promise.all([
      upsertSnapshot("fx", "USDTRY", await fetchFxPayload(), { ttlSeconds: SNAPSHOT_TTLS.fx, source: "cron" }),
      upsertSnapshot("market", "GLOBAL", await fetchMarketPayload(), { ttlSeconds: SNAPSHOT_TTLS.market, source: "cron" }),
      ...symbols.map((symbol) => refreshSymbol("quote", symbol)),
    ]);
    refreshed.push("fx", "market", `quote:${symbols.length}`);
  }

  if (job === "news" || job === "full") {
    await Promise.all(symbols.map((symbol) => refreshSymbol("news", symbol)));
    refreshed.push(`news:${symbols.length}`);
  }

  if (job === "daily" || job === "full") {
    await Promise.all(symbols.map((symbol) => refreshSymbol("company", symbol)));
    refreshed.push(`company:${symbols.length}`);
  }

  return refreshed;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "cron yetkisiz" });
    return;
  }

  const job = typeof req.query?.job === "string" ? req.query.job : "full";
  const startedAt = new Date().toISOString();
  const symbols = await listTrackedSymbols(DEFAULT_TRACKED_SYMBOLS);
  const jobRun = await createJobRun(`cron:${job}`, { symbols, startedAt });

  try {
    const refreshed = await runJob(job, symbols);
    const finished = await finishJobRun(jobRun?.id, "success", { refreshed, symbolCount: symbols.length });
    res.status(200).json({ ok: true, job, symbols, refreshed, startedAt, finishedAt: finished?.finished_at || new Date().toISOString() });
  } catch (error) {
    await finishJobRun(jobRun?.id, "failed", { error: error.message, symbolCount: symbols.length });
    res.status(500).json({ error: error.message, job, symbols, startedAt });
  }
}
