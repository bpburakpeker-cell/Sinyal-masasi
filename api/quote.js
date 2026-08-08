// Vercel Serverless Function — /api/quote?symbol=BIMAS.IS
// Sunucudan sunucuya istek yapıldığı için tarayıcı CORS kısıtlaması devreye girmez.
// Herhangi bir API key gerekmez.

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli, örn: ?symbol=BIMAS.IS" });
    return;
  }

  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Yahoo Finance hata döndürdü: HTTP ${upstream.status}` });
      return;
    }

    const data = await upstream.json();

    // 60 saniye sunucu tarafı önbellek — Yahoo'yu her istekte yormamak için
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Veri alınamadı: " + (err?.message || "bilinmeyen hata") });
  }
}
