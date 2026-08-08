import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, ChevronRight, Activity } from "lucide-react";

/* ============================================================
   SİNYAL MASASI — BIMAS · BINHO · EBEBK Al-Sat Terminali
   Tasarım tokenleri:
   bg #0B0E14 | panel #12161F | panel-alt #171C27 | border #232937
   text #E9E7E1 | muted #8B93A7 | amber #F5A623 | green #34D399 | red #FB5B4D
   Display: Space Grotesk | Body: IBM Plex Sans | Data: IBM Plex Mono
   ============================================================ */

const C = {
  bg: "#0B0E14",
  panel: "#12161F",
  panelAlt: "#171C27",
  border: "#232937",
  text: "#E9E7E1",
  muted: "#8B93A7",
  faint: "#545E73",
  amber: "#F5A623",
  green: "#34D399",
  red: "#FB5B4D",
};

const STOCKS = [
  { symbol: "BIMAS", yahoo: "BIMAS.IS", name: "BİM Birleşik Mağazalar A.Ş.", sector: "Perakende" },
  { symbol: "BINHO", yahoo: "BINHO.IS", name: "1000 Yatırımlar Holding A.Ş.", sector: "Holding" },
  { symbol: "EBEBK", yahoo: "EBEBK.IS", name: "Ebebek Mağazacılık A.Ş.", sector: "Perakende" },
];

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.font-display { font-family: 'Space Grotesk', sans-serif; }
.font-body { font-family: 'IBM Plex Sans', sans-serif; }
.font-mono { font-family: 'IBM Plex Mono', monospace; }
@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.ticker-track { animation: ticker-scroll 22s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
.sm-focus:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 2px; }
input[type=number]::-webkit-inner-spin-button { opacity: 1; }
`;

/* ---------------- indikatör matematiği ---------------- */

function smaSeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function emaSeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  const k = 2 / (period + 1);
  let seed = null;
  for (let i = 0; i < closes.length; i++) {
    if (i === period - 1) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += closes[j];
      seed = s / period;
      out[i] = seed;
    } else if (i >= period) {
      out[i] = closes[i] * k + out[i - 1] * (1 - k);
    }
  }
  return out;
}

function rsiSeries(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function macdSeries(closes) {
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (fast[i] != null && slow[i] != null ? fast[i] - slow[i] : null));
  const validStart = macdLine.findIndex((v) => v != null);
  const compact = macdLine.slice(validStart).map((v) => v);
  const signalCompact = emaSeries(compact, 9);
  const signalLine = new Array(closes.length).fill(null);
  for (let i = 0; i < signalCompact.length; i++) {
    if (signalCompact[i] != null) signalLine[validStart + i] = signalCompact[i];
  }
  const hist = closes.map((_, i) => (macdLine[i] != null && signalLine[i] != null ? macdLine[i] - signalLine[i] : null));
  return { macdLine, signalLine, hist };
}

function clip(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Tek bir günde her indikatörün bağımsız yön sinyali (-1..1) */
function indicatorSignals(i, closes, sma20, sma50, rsi, macd) {
  let sRsi = 0, sMacd = 0, sMa = 0;
  if (rsi[i] != null) sRsi = clip(-(rsi[i] - 50) / 35, -1, 1);
  if (macd.hist[i] != null) {
    const window = macd.hist.slice(Math.max(0, i - 30), i + 1).filter((v) => v != null).map(Math.abs);
    const scale = Math.max(...window, 1e-6);
    sMacd = clip(macd.hist[i] / (scale || 1e-6), -1, 1);
  }
  if (sma20[i] != null && sma50[i] != null) {
    const price = closes[i];
    if (price > sma20[i] && sma20[i] > sma50[i]) sMa = 1;
    else if (price < sma20[i] && sma20[i] < sma50[i]) sMa = -1;
    else if (price > sma20[i]) sMa = 0.5;
    else if (price < sma20[i]) sMa = -0.5;
  }
  return { sRsi, sMacd, sMa };
}

/* Ağırlıkları geçmiş veriye göre uyarlayan basit "öğrenme" adımı:
   her indikatörün geçmişte verdiği + / - sinyalden sonraki gün getirisi
   arasındaki farkı (edge) ölçer ve ağırlıkları buna göre yeniden dağıtır. */
function learnWeights(closes, sma20, sma50, rsi, macd, warmup) {
  const edges = { rsi: [], macd: [], ma: [] };
  for (let i = warmup; i < closes.length - 1; i++) {
    const { sRsi, sMacd, sMa } = indicatorSignals(i, closes, sma20, sma50, rsi, macd);
    const nextRet = (closes[i + 1] - closes[i]) / closes[i];
    edges.rsi.push([sRsi, nextRet]);
    edges.macd.push([sMacd, nextRet]);
    edges.ma.push([sMa, nextRet]);
  }
  function edgeScore(pairs) {
    const pos = pairs.filter((p) => p[0] > 0.15).map((p) => p[1]);
    const neg = pairs.filter((p) => p[0] < -0.15).map((p) => p[1]);
    if (!pos.length || !neg.length) return 0.15;
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    return Math.max(avg(pos) - avg(neg), 0.02);
  }
  const eR = edgeScore(edges.rsi), eM = edgeScore(edges.macd), eA = edgeScore(edges.ma);
  const total = eR + eM + eA || 1;
  return { wRsi: eR / total, wMacd: eM / total, wMa: eA / total };
}

function scoreSeries(closes, sma20, sma50, rsi, macd, weights) {
  return closes.map((_, i) => {
    const { sRsi, sMacd, sMa } = indicatorSignals(i, closes, sma20, sma50, rsi, macd);
    const raw = weights.wRsi * sRsi + weights.wMacd * sMacd + weights.wMa * sMa;
    return Math.round(clip(raw * 100, -100, 100));
  });
}

function signalFromScore(score) {
  if (score >= 25) return "AL";
  if (score <= -25) return "SAT";
  return "BEKLE";
}

/* Basit strateji backtesti: sinyal AL/SAT değiştikçe pozisyon aç/kapat */
function backtest(closes, dates, scores, warmup, startTL) {
  let cash = startTL, shares = 0, inPosition = false;
  let buyHold = { shares: startTL / closes[warmup], };
  const curve = [];
  for (let i = warmup; i < closes.length; i++) {
    const sig = signalFromScore(scores[i]);
    if (sig === "AL" && !inPosition) {
      shares = cash / closes[i];
      cash = 0;
      inPosition = true;
    } else if (sig === "SAT" && inPosition) {
      cash = shares * closes[i];
      shares = 0;
      inPosition = false;
    }
    const value = inPosition ? shares * closes[i] : cash;
    curve.push({ date: dates[i], value });
  }
  const finalValue = inPosition ? shares * closes[closes.length - 1] : cash;
  const buyHoldFinal = buyHold.shares * closes[closes.length - 1];
  return {
    finalValue,
    returnPct: ((finalValue - startTL) / startTL) * 100,
    buyHoldFinal,
    buyHoldReturnPct: ((buyHoldFinal - startTL) / startTL) * 100,
    curve,
  };
}

/* ---------------- veri çekme ---------------- */

async function fetchStockHistory(yahooSymbol) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(yahooSymbol)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sunucu hatası: HTTP ${res.status}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("boş sonuç");
  const ts = result.timestamp || [];
  const closesRaw = result.indicators?.quote?.[0]?.close || [];
  const rows = ts.map((t, i) => ({ t, c: closesRaw[i] })).filter((r) => r.c != null);
  if (rows.length < 60) throw new Error("yetersiz veri");
  return {
    closes: rows.map((r) => r.c),
    dates: rows.map((r) => new Date(r.t * 1000)),
    currency: result.meta?.currency || "TRY",
    prevClose: result.meta?.previousClose ?? rows[rows.length - 2]?.c,
  };
}

async function fetchUsdTry() {
  try {
    const res = await fetch("/api/fx");
    if (!res.ok) return null;
    const json = await res.json();
    return json?.rate || null;
  } catch (e) {
    return null;
  }
}

/* Tüm canlı kaynaklar engellendiğinde uygulamanın işlevini gösterebilmek için
   AÇIKÇA ETİKETLENMİŞ örnek/sentetik veri üretici. Gerçek fiyat değildir. */
function generateDemoHistory(basePrice, days = 260) {
  const closes = [];
  const dates = [];
  let price = basePrice;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const drift = 0.0002;
    const shock = (Math.random() - 0.5) * 0.028;
    price = Math.max(price * (1 + drift + shock), 0.5);
    closes.push(Number(price.toFixed(2)));
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  return { closes, dates, currency: "TRY", prevClose: closes[closes.length - 2] };
}

/* ---------------- küçük UI parçaları ---------------- */

function Sparkline({ closes, color }) {
  if (!closes || closes.length < 2) return null;
  const w = 120, h = 36;
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = max - min || 1;
  const pts = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * w;
    const y = h - ((c - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Gauge({ score }) {
  // yarım daire gösterge: -100..100
  const angle = (clip(score, -100, 100) / 100) * 90; // -90..90 derece
  const needleColor = score >= 25 ? C.green : score <= -25 ? C.red : C.amber;
  const r = 46, cx = 54, cy = 54;
  const arc = (startDeg, endDeg, col) => {
    const toRad = (d) => ((d - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg)), y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg)), y2 = cy + r * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} stroke={col} strokeWidth="8" fill="none" strokeLinecap="round" />;
  };
  const needleRad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + (r - 10) * Math.cos(needleRad), ny = cy + (r - 10) * Math.sin(needleRad);
  return (
    <svg width="108" height="66" viewBox="0 0 108 66">
      {arc(0, 60, C.red)}
      {arc(60, 120, C.amber)}
      {arc(120, 180, C.green)}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill={needleColor} />
    </svg>
  );
}

function SignalBadge({ signal }) {
  const cfg = {
    AL: { bg: "rgba(52,211,153,0.14)", fg: C.green, Icon: TrendingUp, label: "AL" },
    SAT: { bg: "rgba(251,91,77,0.14)", fg: C.red, Icon: TrendingDown, label: "SAT" },
    BEKLE: { bg: "rgba(245,166,35,0.14)", fg: C.amber, Icon: Minus, label: "BEKLE" },
  }[signal];
  const Icon = cfg.Icon;
  return (
    <span className="font-mono inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide"
      style={{ background: cfg.bg, color: cfg.fg }}>
      <Icon size={13} strokeWidth={2.5} /> {cfg.label}
    </span>
  );
}

/* ---------------- ana kart ---------------- */

function StockCard({ stock, data, status, error, onRetry, onDemo, selected, onSelect, usdTry }) {
  return (
    <button
      onClick={() => data && onSelect(stock.symbol)}
      className="sm-focus text-left rounded-xl p-4 transition-colors w-full"
      style={{
        background: C.panel,
        border: `1px solid ${selected ? C.amber : C.border}`,
        cursor: data ? "pointer" : "default",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display font-semibold text-lg tracking-tight" style={{ color: C.text }}>{stock.symbol}</div>
          <div className="font-body text-xs mt-0.5" style={{ color: C.muted }}>{stock.name}</div>
        </div>
        {data && <Gauge score={data.score} />}
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 mt-4 mb-2 font-body text-xs" style={{ color: C.muted }}>
          <RefreshCw size={13} className="animate-spin" /> Veri alınıyor…
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 mb-1">
          <div className="flex items-center gap-2 font-body text-xs mb-2" style={{ color: C.red }}>
            <AlertTriangle size={13} /> {error || "Veri alınamadı"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(stock.symbol); }}
              className="font-mono text-xs px-2.5 py-1 rounded-md sm-focus"
              style={{ border: `1px solid ${C.border}`, color: C.text }}
            >
              Tekrar dene
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDemo(stock.symbol); }}
              className="font-mono text-xs px-2.5 py-1 rounded-md sm-focus"
              style={{ border: `1px solid ${C.amber}`, color: C.amber }}
            >
              Örnek veriyle gör
            </button>
          </div>
        </div>
      )}

      {status === "ready" && data && (
        <>
          {data.isDemo && (
            <div className="font-mono text-[10px] tracking-wide mt-2 px-2 py-0.5 rounded inline-block"
              style={{ background: "rgba(245,166,35,0.14)", color: C.amber }}>
              ÖRNEK VERİ — gerçek değil
            </div>
          )}
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="font-mono text-2xl font-semibold" style={{ color: C.text }}>
                {data.price.toFixed(2)} <span className="text-sm font-normal" style={{ color: C.muted }}>TRY</span>
              </div>
              <div className="font-mono text-xs mt-0.5" style={{ color: data.changePct >= 0 ? C.green : C.red }}>
                {data.changePct >= 0 ? "▲" : "▼"} %{Math.abs(data.changePct).toFixed(2)}
              </div>
              {usdTry && (
                <div className="font-mono text-[11px] mt-1" style={{ color: C.faint }}>
                  ≈ ${(data.price / usdTry).toFixed(2)} USD
                </div>
              )}
            </div>
            <Sparkline closes={data.closes.slice(-40)} color={data.changePct >= 0 ? C.green : C.red} />
          </div>

          <div className="flex items-center justify-between mt-4">
            <SignalBadge signal={data.signal} />
            <span className="inline-flex items-center gap-1 font-body text-xs" style={{ color: C.faint }}>
              Detay <ChevronRight size={13} />
            </span>
          </div>
        </>
      )}
    </button>
  );
}

/* ---------------- indikatör satırı ---------------- */

function IndicatorRow({ label, value, sub, barPct, color }) {
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-body text-xs" style={{ color: C.muted }}>{label}</span>
        <span className="font-mono text-sm" style={{ color: C.text }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.panelAlt }}>
        <div className="h-full rounded-full" style={{ width: `${clip(barPct, 0, 100)}%`, background: color }} />
      </div>
      {sub && <div className="font-body text-[11px] mt-1" style={{ color: C.faint }}>{sub}</div>}
    </div>
  );
}

/* ---------------- detay + simülasyon paneli ---------------- */

function DetailPanel({ stock, data, usdTry }) {
  const [amount, setAmount] = useState(100);
  if (!data) return null;

  const bt = useMemo(() => backtest(data.closes, data.dates, data.scoreSeries, data.warmup, Math.max(amount, 1)),
    [data, amount]);

  const rsiVal = data.rsi;
  const macdHist = data.macdHist;

  return (
    <div className="rounded-xl p-5 mt-1" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-semibold text-base" style={{ color: C.text }}>{stock.symbol} · Sinyal Kırılımı</div>
          <div className="font-body text-xs mt-0.5" style={{ color: C.muted }}>
            {stock.sector} · {data.isDemo ? "örnek/sentetik veri" : "15 dk gecikmeli veri"}
          </div>
        </div>
        <SignalBadge signal={data.signal} />
      </div>
      {data.isDemo && (
        <div className="rounded-lg px-3 py-2 mb-4 font-body text-[11px]"
          style={{ background: "rgba(245,166,35,0.1)", border: `1px solid rgba(245,166,35,0.3)`, color: C.amber }}>
          Bu hissenin canlı verisine şu an ulaşılamadı. Aşağıdaki sayılar gerçek {stock.symbol} fiyatları değil, uygulamanın nasıl çalıştığını göstermek için üretilmiş rastgele bir örnek seridir.
        </div>
      )}

      <IndicatorRow
        label="RSI (14)"
        value={rsiVal != null ? rsiVal.toFixed(1) : "—"}
        sub={rsiVal != null ? (rsiVal < 30 ? "Aşırı satım bölgesi — teknik olarak alım için uygun" : rsiVal > 70 ? "Aşırı alım bölgesi — teknik olarak satış için uygun" : "Nötr bölge") : ""}
        barPct={rsiVal ?? 50}
        color={rsiVal < 30 ? C.green : rsiVal > 70 ? C.red : C.amber}
      />
      <IndicatorRow
        label="MACD Histogram"
        value={macdHist != null ? macdHist.toFixed(3) : "—"}
        sub={macdHist != null ? (macdHist > 0 ? "Momentum yukarı yönlü" : "Momentum aşağı yönlü") : ""}
        barPct={macdHist != null ? 50 + clip(macdHist * 200, -50, 50) : 50}
        color={macdHist > 0 ? C.green : C.red}
      />
      <IndicatorRow
        label="Hareketli Ortalama (20/50)"
        value={data.maTrend}
        sub="Fiyat kısa ve uzun vadeli ortalamalara göre konumlanıyor"
        barPct={data.maTrend === "Yükseliş" ? 80 : data.maTrend === "Düşüş" ? 20 : 50}
        color={data.maTrend === "Yükseliş" ? C.green : data.maTrend === "Düşüş" ? C.red : C.amber}
      />

      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="font-body text-[11px]" style={{ color: C.faint }}>
          Ağırlıklar (uyarlanabilir) — RSI %{Math.round(data.weights.wRsi * 100)} · MACD %{Math.round(data.weights.wMacd * 100)} · MA %{Math.round(data.weights.wMa * 100)}.
          Bu ağırlıklar her yenilemede geçmiş fiyat hareketine göre yeniden hesaplanır; gerçek zamanlı öğrenen bir yapay zeka modeli değil, basit uyarlamalı bir sezgiseldir.
        </div>
      </div>

      {/* Simülasyon */}
      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={15} style={{ color: C.amber }} />
          <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Geriye Dönük Simülasyon</span>
        </div>
        <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Başlangıç tutarı (TL)</label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 1)}
          className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
            <div className="font-body text-[11px]" style={{ color: C.faint }}>Strateji ile bugünkü değer</div>
            <div className="font-mono text-lg mt-1" style={{ color: bt.returnPct >= 0 ? C.green : C.red }}>
              {bt.finalValue.toFixed(2)} TL
            </div>
            <div className="font-mono text-xs mt-0.5" style={{ color: bt.returnPct >= 0 ? C.green : C.red }}>
              {bt.returnPct >= 0 ? "+" : ""}{bt.returnPct.toFixed(2)}%
            </div>
            {usdTry && (
              <div className="font-mono text-[11px] mt-1" style={{ color: C.faint }}>
                ≈ ${(bt.finalValue / usdTry).toFixed(2)} USD
              </div>
            )}
          </div>
          <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
            <div className="font-body text-[11px]" style={{ color: C.faint }}>Sadece al-ve-tut (kıyas)</div>
            <div className="font-mono text-lg mt-1" style={{ color: bt.buyHoldReturnPct >= 0 ? C.green : C.red }}>
              {bt.buyHoldFinal.toFixed(2)} TL
            </div>
            <div className="font-mono text-xs mt-0.5" style={{ color: bt.buyHoldReturnPct >= 0 ? C.green : C.red }}>
              {bt.buyHoldReturnPct >= 0 ? "+" : ""}{bt.buyHoldReturnPct.toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="font-body text-[11px] mt-3" style={{ color: C.faint }}>
          Simülasyon son ~1 yıllık geçmiş veri üzerinden, sinyal her değiştiğinde tüm bakiyenin alınıp satıldığı varsayımıyla hesaplanır. İşlem maliyeti/vergi içermez. Geçmiş performans gelecekteki sonuçların garantisi değildir.
        </div>
      </div>
    </div>
  );
}

/* ---------------- ticker şeridi ---------------- */

function TickerStrip({ items, usdTry }) {
  const content = items.filter((it) => it.data);
  if (!content.length) return null;
  const row = (keyPrefix) => (
    <div className="flex items-center gap-8 pr-8">
      {content.map((it) => (
        <span key={keyPrefix + it.stock.symbol} className="font-mono text-xs whitespace-nowrap flex items-center gap-1.5">
          <span style={{ color: C.muted }}>{it.stock.symbol}</span>
          <span style={{ color: C.text }}>{it.data.price.toFixed(2)}</span>
          <span style={{ color: it.data.changePct >= 0 ? C.green : C.red }}>
            {it.data.changePct >= 0 ? "▲" : "▼"}%{Math.abs(it.data.changePct).toFixed(2)}
          </span>
        </span>
      ))}
      {usdTry && (
        <span className="font-mono text-xs whitespace-nowrap" style={{ color: C.amber }}>
          USD/TRY {usdTry.toFixed(4)}
        </span>
      )}
    </div>
  );
  return (
    <div className="overflow-hidden py-2 px-4 rounded-lg mb-5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
      <div className="flex ticker-track" style={{ width: "max-content" }}>
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

/* ---------------- ana uygulama ---------------- */

export default function SinyalMasasi() {
  const [statusMap, setStatusMap] = useState({});
  const [dataMap, setDataMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [usdTry, setUsdTry] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const mounted = useRef(true);

  const packageHistory = (hist) => {
    const closes = hist.closes;
    const dates = hist.dates;
    const sma20 = smaSeries(closes, 20);
    const sma50 = smaSeries(closes, 50);
    const rsi = rsiSeries(closes, 14);
    const macd = macdSeries(closes);
    const warmup = 50;
    const weights = learnWeights(closes, sma20, sma50, rsi, macd, warmup);
    const scores = scoreSeries(closes, sma20, sma50, rsi, macd, weights);
    const last = closes.length - 1;
    const price = closes[last];
    const prevClose = hist.prevClose ?? closes[last - 1];
    const changePct = ((price - prevClose) / prevClose) * 100;
    const maTrend = sma20[last] > sma50[last] ? "Yükseliş" : sma20[last] < sma50[last] ? "Düşüş" : "Yatay";
    return {
      closes, dates, sma20, sma50, rsi: rsi[last], macdHist: macd.hist[last],
      score: scores[last], scoreSeries: scores, signal: signalFromScore(scores[last]),
      price, changePct, maTrend, weights, warmup,
    };
  };

  const loadStock = useCallback(async (stock) => {
    setStatusMap((m) => ({ ...m, [stock.symbol]: "loading" }));
    setErrorMap((m) => ({ ...m, [stock.symbol]: null }));
    try {
      const hist = await fetchStockHistory(stock.yahoo);
      const packaged = { ...packageHistory(hist), isDemo: false };
      if (!mounted.current) return;
      setDataMap((m) => ({ ...m, [stock.symbol]: packaged }));
      setStatusMap((m) => ({ ...m, [stock.symbol]: "ready" }));
    } catch (e) {
      if (!mounted.current) return;
      setErrorMap((m) => ({ ...m, [stock.symbol]: e.message || "Veri alınamadı" }));
      setStatusMap((m) => ({ ...m, [stock.symbol]: "error" }));
    }
  }, []);

  const loadDemo = useCallback((stock) => {
    const bases = { BIMAS: 490, BINHO: 9.5, EBEBK: 60 };
    const hist = generateDemoHistory(bases[stock.symbol] || 100);
    const packaged = { ...packageHistory(hist), isDemo: true };
    setDataMap((m) => ({ ...m, [stock.symbol]: packaged }));
    setStatusMap((m) => ({ ...m, [stock.symbol]: "ready" }));
    setErrorMap((m) => ({ ...m, [stock.symbol]: null }));
  }, []);

  const loadAll = useCallback(() => {
    STOCKS.forEach(loadStock);
    fetchUsdTry().then((r) => mounted.current && setUsdTry(r));
    setLastUpdate(new Date());
  }, [loadStock]);

  useEffect(() => {
    mounted.current = true;
    loadAll();
    const interval = setInterval(loadAll, 5 * 60 * 1000); // 5 dakikada bir yenile
    return () => { mounted.current = false; clearInterval(interval); };
  }, [loadAll]);

  const items = STOCKS.map((stock) => ({ stock, data: dataMap[stock.symbol] }));
  const selectedItem = items.find((it) => it.stock.symbol === selected) || items.find((it) => it.data);

  return (
    <div className="min-h-screen font-body" style={{ background: C.bg }}>
      <style>{FONT_STYLE}</style>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: C.text }}>Sinyal Masası</h1>
            <p className="font-body text-xs mt-1" style={{ color: C.muted }}>BIMAS · BINHO · EBEBK — teknik analiz ağırlıklı al/sat terminali</p>
          </div>
          <button
            onClick={loadAll}
            className="sm-focus flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}
          >
            <RefreshCw size={13} /> Yenile
          </button>
        </div>

        <TickerStrip items={items} usdTry={usdTry} />

        <div
          className="rounded-lg px-3.5 py-2.5 mb-5 flex items-start gap-2"
          style={{ background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.25)` }}
        >
          <AlertTriangle size={14} style={{ color: C.amber, marginTop: 2, flexShrink: 0 }} />
          <p className="font-body text-[11px]" style={{ color: C.amber }}>
            Bu araç yatırım tavsiyesi vermez; sinyaller teknik göstergelerin otomatik yorumudur. Veriler halka açık kaynaklardan ~15 dakika gecikmeli alınır. Yatırım kararlarınızı kendi araştırmanıza ve gerekirse lisanslı bir yatırım danışmanına dayandırın.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {items.map(({ stock, data }) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              data={data}
              status={statusMap[stock.symbol] || "loading"}
              error={errorMap[stock.symbol]}
              onRetry={() => loadStock(stock)}
              onDemo={() => loadDemo(stock)}
              selected={selected === stock.symbol || (!selected && selectedItem?.stock.symbol === stock.symbol)}
              onSelect={setSelected}
              usdTry={usdTry}
            />
          ))}
        </div>

        <div className="mt-4">
          {selectedItem?.data ? (
            <DetailPanel stock={selectedItem.stock} data={selectedItem.data} usdTry={usdTry} />
          ) : (
            <div className="rounded-xl p-6 text-center font-body text-xs mt-1" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.faint }}>
              Detayları görmek için veri yüklenen bir hisseye dokun.
            </div>
          )}
        </div>

        {lastUpdate && (
          <div className="font-mono text-[11px] text-center mt-5" style={{ color: C.faint }}>
            Son yenileme: {lastUpdate.toLocaleTimeString("tr-TR")} · 5 dakikada bir otomatik yenilenir
          </div>
        )}
      </div>
    </div>
  );
}
