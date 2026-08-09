/**
 * GET /api/signal?symbol=BIMAS
 *
 * DB'den son tarihin sinyal + model verilerini döner.
 * DB yoksa veya veri yoksa 503 (uygulama bozulmaz, istemci fallback yapar).
 */

import { Pool } from "pg";
import { MODEL_LABELS } from "../lib/modelLabels.js";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 })
  : null;

export default async function handler(req, res) {
  const symbol = (req.query.symbol || "").toUpperCase().trim();
  if (!symbol) {
    return res.status(400).json({ error: "symbol parametresi gerekli" });
  }

  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL tanımlı değil" });
  }

  try {
    const client = await pool.connect();
    try {
      // Son sinyal
      const sigResult = await client.query(
        `SELECT fs.date, fs.final_score, fs.signal, fs.regime,
                fs.weight_technical, fs.weight_volatility, fs.weight_rel_strength,
                fs.confirmed,
                st.name, st.sector
           FROM final_signals fs
           LEFT JOIN stocks st ON st.symbol = fs.symbol
          WHERE fs.symbol = $1
          ORDER BY fs.date DESC
          LIMIT 1`,
        [symbol],
      );

      if (sigResult.rows.length === 0) {
        return res.status(404).json({
          error: "Bu sembol için henüz sinyal yok. Pipeline çalıştırılmamış olabilir.",
          symbol,
        });
      }

      const sig = sigResult.rows[0];

      // Model ağırlıkları
      const weightMap = {
        technical:         sig.weight_technical,
        volatility:        sig.weight_volatility,
        relative_strength: sig.weight_rel_strength,
      };

      // Model performans
      const perfResult = await client.query(
        `SELECT model_key, hit_rate_pct, sample_size
           FROM model_performance
          WHERE symbol = $1`,
        [symbol],
      );

      const perfMap = {};
      perfResult.rows.forEach((r) => {
        perfMap[r.model_key] = {
          hit_rate_pct: r.hit_rate_pct != null ? parseFloat(r.hit_rate_pct) : null,
          sample_size:  parseInt(r.sample_size, 10),
        };
      });

      // models dizisi: ağırlığa göre büyükten küçüğe sırala
      const models = Object.entries(weightMap)
        .map(([key, weightRaw]) => {
          const meta  = MODEL_LABELS[key] || { key, label: key, short: key, description: "" };
          const perf  = perfMap[key] || { hit_rate_pct: null, sample_size: 0 };
          const w     = weightRaw != null ? parseFloat(weightRaw) : 0;
          return {
            key,
            label:       meta.label,
            short:       meta.short,
            description: meta.description,
            weightPct:   Math.round(w * 100),
            hitRatePct:  perf.hit_rate_pct,
            sampleSize:  perf.sample_size,
          };
        })
        .sort((a, b) => b.weightPct - a.weightPct);

      const payload = {
        symbol,
        name:        sig.name    || symbol,
        sector:      sig.sector  || null,
        final_score: parseFloat(sig.final_score),
        signal:      sig.signal,
        regime:      sig.regime,
        confirmed:   sig.confirmed,
        date:        sig.date,
        models,
      };

      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
      return res.status(200).json(payload);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("signal.js hata:", err.message);
    return res.status(503).json({ error: "Sinyal alınamadı: " + err.message });
  }
}
