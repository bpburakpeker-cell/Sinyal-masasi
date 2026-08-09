import { SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchFxPayload } from "./_lib/providers.js";
import { getSnapshotOrRefresh } from "./_lib/snapshots.js";

export default async function handler(_req, res) {
  try {
    const { payload, meta } = await getSnapshotOrRefresh({
      kind: "fx",
      symbol: "USDTRY",
      ttlSeconds: SNAPSHOT_TTLS.fx,
      fetcher: fetchFxPayload,
      source: "fx-route",
    });
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    if (meta.stale) res.setHeader("X-Snapshot-Stale", "1");
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: err?.message || "USD/TRY kuru alınamadı" });
  }
}
