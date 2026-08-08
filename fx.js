// Vercel Serverless Function — /api/fx
// USD/TRY kurunu ücretsiz, key'siz kaynaklardan sunucu tarafında çeker.

export default async function handler(req, res) {
  const sources = [
    async () => {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
      const j = await r.json();
      return j?.rates?.TRY;
    },
    async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const j = await r.json();
      return j?.rates?.TRY;
    },
  ];

  for (const source of sources) {
    try {
      const rate = await source();
      if (rate) {
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
        res.status(200).json({ rate });
        return;
      }
    } catch (e) {
      // sıradaki kaynağa geç
    }
  }

  res.status(502).json({ error: "USD/TRY kuru alınamadı" });
}
