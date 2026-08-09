/**
 * GET /api/performance?symbols=BIMAS,BINHO,EBEBK&range=week|month|year
 *
 * Seçilen hisseler için "sinyalleri gerçekten takip etseydiniz" pozisyon bazlı
 * getirisini (final_signals + prices) hesaplar, Al-ve-Tut ile karşılaştırır ve
 * eşit ağırlıklı sepet olarak birleştirir. Dashboard'daki "Toplam Portföy
 * Performansı" kartı ve hisse detayındaki "Performans" sekmesi bunu kullanır.
 */

import { Pool } from "pg";
import { MODEL_LABELS } from "../lib/modelLabels.js";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 })
  : null;

const RANGE_DAYS = { week: 7, month: 30, year: 365 };
const MIN_TRADES_FOR_HIT_RATE = 5;

/**
 * signalRows/priceRows: tarihe göre artan sıralı [{date, signal|close}].
 * AL sinyaliyle pozisyona girer, sinyal AL olmaktan çıkınca o günün kapanışıyla
 * çıkar. Döner: { curve: [{date, pct}], totalReturnPct, tradeCount, winCount, maxDrawdownPct }
 */
function computePositionReturns(signalRows, priceRows) {
  const signalMap = new Map(signalRows.map((r) => [r.date, r.signal]));

  let equity = 1;
  let inPosition = false;
  let entryPrice = null;
  let tradeCount = 0;
  let winCount = 0;
  let peak = 1;
  let maxDd = 0;
  const curve = [];

  for (const { date, close: price } of priceRows) {
    const sig = signalMap.get(date);

    if (!inPosition && sig === "AL") {
      inPosition = true;
      entryPrice = price;
    } else if (inPosition && sig && sig !== "AL") {
      const tradeReturn = (price - entryPrice) / entryPrice;
      equity *= 1 + tradeReturn;
      tradeCount += 1;
      if (tradeReturn > 0) winCount += 1;
      inPosition = false;
      entryPrice = null;
    }

    const markEquity = inPosition && entryPrice ? equity * (price / entryPrice) : equity;
    curve.push({ date, pct: (markEquity - 1) * 100 });

    peak = Math.max(peak, markEquity);
    const dd = peak > 0 ? ((peak - markEquity) / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd);
  }

  return {
    curve,
    totalReturnPct: curve.length ? curve[curve.length - 1].pct : 0,
    tradeCount,
    winCount,
    maxDrawdownPct: maxDd,
  };
}

function benchmarkCurve(priceRows) {
  if (!priceRows.length) return [];
  const base = priceRows[0].close;
  return priceRows.map((r) => ({ date: r.date, pct: ((r.close - base) / base) * 100 }));
}

function fmtDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

export default async function handler(req, res) {
  const symbolsParam = (req.query.symbols || "").toUpperCase().trim();
  const range = (req.query.range || "year").toLowerCase();
  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);

  if (!symbols.length) {
    return res.status(400).json({ error: "symbols parametresi gerekli" });
  }
  if (!RANGE_DAYS[range]) {
    return res.status(400).json({ error: "range 'week', 'month' veya 'year' olmalı" });
  }
  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL tanımlı değil" });
  }

  const days = RANGE_DAYS[range];

  try {
    const client = await pool.connect();
    try {
      const perStock = {};
      // date -> { stratSum, benchSum, count }
      const basket = new Map();
      let totalTrades = 0;
      let totalWins = 0;
      let anyData = false;

      for (const symbol of symbols) {
        // pg Client tek seferde bir sorgu çalıştırabilir — aynı bağlantıda
        // Promise.all ile paralel sorgu çalıştırmak deprecated/riskli, sırayla çekilir.
        const pricesResult = await client.query(
          `SELECT date, close FROM prices
            WHERE symbol = $1 AND date >= CURRENT_DATE - $2::int
            ORDER BY date ASC`,
          [symbol, days],
        );
        const signalsResult = await client.query(
          `SELECT date, signal FROM final_signals
            WHERE symbol = $1 AND date >= CURRENT_DATE - $2::int
            ORDER BY date ASC`,
          [symbol, days],
        );
        const lastSignalResult = await client.query(
          `SELECT signal, weight_technical, weight_volatility, weight_rel_strength
             FROM final_signals WHERE symbol = $1 ORDER BY date DESC LIMIT 1`,
          [symbol],
        );

        const priceRows = pricesResult.rows.map((r) => ({ date: fmtDate(r.date), close: parseFloat(r.close) }));
        const signalRows = signalsResult.rows.map((r) => ({ date: fmtDate(r.date), signal: r.signal }));
        if (!priceRows.length) continue;
        anyData = true;

        const pos = computePositionReturns(signalRows, priceRows);
        const bench = benchmarkCurve(priceRows);
        totalTrades += pos.tradeCount;
        totalWins += pos.winCount;

        let leadingModel = null;
        const lastRow = lastSignalResult.rows[0];
        if (lastRow) {
          const weightMap = {
            technical: parseFloat(lastRow.weight_technical) || 0,
            volatility: parseFloat(lastRow.weight_volatility) || 0,
            relative_strength: parseFloat(lastRow.weight_rel_strength) || 0,
          };
          const top = Object.entries(weightMap).sort((a, b) => b[1] - a[1])[0];
          leadingModel = top ? (MODEL_LABELS[top[0]]?.short || top[0]) : null;
        }

        perStock[symbol] = {
          deltaPct: Math.round(pos.totalReturnPct * 10) / 10,
          leadingModel,
        };

        pos.curve.forEach((p, i) => {
          const b = bench[i];
          const acc = basket.get(p.date) || { stratSum: 0, benchSum: 0, count: 0 };
          acc.stratSum += p.pct;
          acc.benchSum += b ? b.pct : 0;
          acc.count += 1;
          basket.set(p.date, acc);
        });
      }

      if (!anyData) {
        return res.status(404).json({
          error: "Bu semboller için veri yok. Pipeline veya backfill henüz çalıştırılmamış olabilir.",
          symbols,
        });
      }

      const labels = Array.from(basket.keys()).sort();
      const strategy = labels.map((d) => Math.round((basket.get(d).stratSum / basket.get(d).count) * 100) / 100);
      const benchmark = labels.map((d) => Math.round((basket.get(d).benchSum / basket.get(d).count) * 100) / 100);

      let basketPeak = strategy.length ? 1 + strategy[0] / 100 : 1;
      let basketMaxDd = 0;
      strategy.forEach((pct) => {
        const eq = 1 + pct / 100;
        basketPeak = Math.max(basketPeak, eq);
        basketMaxDd = Math.max(basketMaxDd, basketPeak > 0 ? ((basketPeak - eq) / basketPeak) * 100 : 0);
      });

      const hitPct = totalTrades >= MIN_TRADES_FOR_HIT_RATE
        ? Math.round((totalWins / totalTrades) * 1000) / 10
        : null;

      const payload = {
        range,
        symbols,
        labels,
        strategy,
        benchmark,
        kpi: {
          stratPct: strategy.length ? strategy[strategy.length - 1] : 0,
          benchPct: benchmark.length ? benchmark[benchmark.length - 1] : 0,
          alphaPct: strategy.length
            ? Math.round((strategy[strategy.length - 1] - benchmark[benchmark.length - 1]) * 10) / 10
            : 0,
          hitPct,
          tradeCount: totalTrades,
          maxDrawdownPct: Math.round(basketMaxDd * 10) / 10,
        },
        perStock,
      };

      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=600");
      return res.status(200).json(payload);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("performance.js hata:", err.message);
    return res.status(503).json({ error: "Performans verisi alınamadı: " + err.message });
  }
}
