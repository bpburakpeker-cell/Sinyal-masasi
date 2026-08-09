import { SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchNewsPayload } from "./_lib/providers.js";
import { getSnapshotOrRefresh } from "./_lib/snapshots.js";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli" });
    return;
  }

  try {
    const { payload, meta } = await getSnapshotOrRefresh({
      kind: "news",
      symbol,
      ttlSeconds: SNAPSHOT_TTLS.news,
      fetcher: () => fetchNewsPayload(symbol),
      source: "news-route",
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1200");
    if (meta.stale) res.setHeader("X-Snapshot-Stale", "1");
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: "Haber verisi alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
