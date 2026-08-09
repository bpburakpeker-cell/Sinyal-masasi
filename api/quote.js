import { SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchQuotePayload } from "./_lib/providers.js";
import { getSnapshotOrRefresh } from "./_lib/snapshots.js";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli, örn: ?symbol=BIMAS.IS" });
    return;
  }

  try {
    const { payload, meta } = await getSnapshotOrRefresh({
      kind: "quote",
      symbol,
      ttlSeconds: SNAPSHOT_TTLS.quote,
      fetcher: () => fetchQuotePayload(symbol),
      source: "quote-route",
    });
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    if (meta.stale) res.setHeader("X-Snapshot-Stale", "1");
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: "Veri alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
