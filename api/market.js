import { SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchMarketPayload } from "./_lib/providers.js";
import { getSnapshotOrRefresh } from "./_lib/snapshots.js";

export default async function handler(_req, res) {
  try {
    const { payload, meta } = await getSnapshotOrRefresh({
      kind: "market",
      symbol: "GLOBAL",
      ttlSeconds: SNAPSHOT_TTLS.market,
      fetcher: fetchMarketPayload,
      source: "market-route",
    });
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    if (meta.stale) res.setHeader("X-Snapshot-Stale", "1");
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: "Piyasa verisi alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
