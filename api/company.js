import { SNAPSHOT_TTLS } from "./_lib/defaults.js";
import { fetchCompanyPayload } from "./_lib/providers.js";
import { getSnapshotOrRefresh } from "./_lib/snapshots.js";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli" });
    return;
  }

  try {
    const { payload, meta } = await getSnapshotOrRefresh({
      kind: "company",
      symbol,
      ttlSeconds: SNAPSHOT_TTLS.company,
      fetcher: () => fetchCompanyPayload(symbol),
      source: "company-route",
    });
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    if (meta.stale) res.setHeader("X-Snapshot-Stale", "1");
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: "Şirket verisi alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
