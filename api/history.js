/**
 * GET /api/history?symbol=BIMAS&days=90
 *
 * DB'deki prices tablosundan son N günün kapanış verilerini döner.
 * Grafik bileşeni için kullanılır — Yahoo'ya gitmez.
 */

import { Pool } from "pg";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 })
  : null;

export default async function handler(req, res) {
  const symbol = (req.query.symbol || "").toUpperCase().trim();
  const days   = Math.min(parseInt(req.query.days || "90", 10), 365);

  if (!symbol) {
    return res.status(400).json({ error: "symbol parametresi gerekli" });
  }

  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL tanımlı değil" });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT date, open, high, low, close, volume
           FROM prices
          WHERE symbol = $1
          ORDER BY date ASC
          LIMIT $2`,
        [symbol, days],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Fiyat verisi bulunamadı", symbol });
      }

      const rows = result.rows.map((r) => ({
        date:   r.date,
        open:   r.open   != null ? parseFloat(r.open)   : null,
        high:   r.high   != null ? parseFloat(r.high)   : null,
        low:    r.low    != null ? parseFloat(r.low)    : null,
        close:  parseFloat(r.close),
        volume: r.volume != null ? parseInt(r.volume, 10) : null,
      }));

      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
      return res.status(200).json({ symbol, rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("history.js hata:", err.message);
    return res.status(503).json({ error: "Geçmiş veri alınamadı: " + err.message });
  }
}
