function pctChange(closes, lookback) {
  if (!Array.isArray(closes) || closes.length <= lookback) return 0;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lookback];
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev === 0) return 0;
  return ((now - prev) / prev) * 100;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)",
      Accept: "application/json",
    },
  });
  if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
  const json = await upstream.json();
  const result = json?.chart?.result?.[0];
  const closesRaw = result?.indicators?.quote?.[0]?.close || [];
  const timestamps = result?.timestamp || [];
  const rows = timestamps.map((t, i) => ({ t, c: closesRaw[i] })).filter((row) => Number.isFinite(row.c));
  return {
    symbol,
    closes: rows.map((row) => row.c),
    dates: rows.map((row) => new Date(row.t * 1000).toISOString()),
  };
}

function compactSeries(series) {
  const closes = series.closes || [];
  const latest = closes[closes.length - 1] ?? null;
  return {
    symbol: series.symbol,
    latest,
    change5d: pctChange(closes, 5),
    change20d: pctChange(closes, 20),
    change60d: pctChange(closes, 60),
  };
}

export default async function handler(req, res) {
  try {
    const [xu100, usdtry] = await Promise.all([
      fetchChart("^XU100"),
      fetchChart("TRY=X"),
    ]);

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      xu100: compactSeries(xu100),
      usdTry: compactSeries(usdtry),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "Piyasa verisi alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
