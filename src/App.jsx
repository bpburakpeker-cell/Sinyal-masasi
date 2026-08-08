import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  ChevronRight, Activity, Plus, Search, X, ArrowLeft,
  Newspaper, Briefcase, Edit3, Check,
} from "lucide-react";

/* ================================================================
   SİNYAL MASASI  v2 — Kullanıcı Odaklı Al/Sat Terminali
   Tasarım tokenleri:
   bg #0B0E14 | panel #12161F | panelAlt #171C27 | border #232937
   text #E9E7E1 | muted #8B93A7 | faint #545E73
   amber #F5A623 | green #34D399 | red #FB5B4D | blue #60A5FA
   ================================================================ */

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
  blue: "#60A5FA",
};

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.font-display { font-family: 'Space Grotesk', sans-serif; }
.font-body { font-family: 'IBM Plex Sans', sans-serif; }
.font-mono { font-family: 'IBM Plex Mono', monospace; }
@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.ticker-track { animation: ticker-scroll 24s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
.sm-focus:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 2px; }
input[type=number]::-webkit-inner-spin-button { opacity: 1; }
input[type=number] { -moz-appearance: textfield; }
.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:50;display:flex;align-items:center;justify-content:center; }
.detail-overlay { position:fixed;inset:0;overflow-y:auto;z-index:40;background:${C.bg}; }
`;

/* ────────────────────────────────────────────────────────────────
   BIST popüler hisseler listesi
   ────────────────────────────────────────────────────────────── */
const BIST_LIST = [
  { symbol: "THYAO", name: "Türk Hava Yolları A.Ş.", sector: "Ulaşım" },
  { symbol: "TUPRS", name: "Tüpraş Petrol Rafinerileri", sector: "Enerji" },
  { symbol: "TCELL", name: "Turkcell İletişim Hizm.", sector: "Telekom" },
  { symbol: "AKBNK", name: "Akbank T.A.Ş.", sector: "Bankacılık" },
  { symbol: "GARAN", name: "Garanti BBVA", sector: "Bankacılık" },
  { symbol: "ISCTR", name: "Türkiye İş Bankası", sector: "Bankacılık" },
  { symbol: "YKBNK", name: "Yapı ve Kredi Bankası", sector: "Bankacılık" },
  { symbol: "SISE",  name: "Şişecam A.Ş.", sector: "Cam & Kimya" },
  { symbol: "KCHOL", name: "Koç Holding A.Ş.", sector: "Holding" },
  { symbol: "SAHOL", name: "Sabancı Holding A.Ş.", sector: "Holding" },
  { symbol: "TOASO", name: "Tofaş Oto. Fab.", sector: "Otomotiv" },
  { symbol: "FROTO", name: "Ford Otomotiv Sanayi", sector: "Otomotiv" },
  { symbol: "EKGYO", name: "Emlak Konut GYO", sector: "GYO" },
  { symbol: "PGSUS", name: "Pegasus Hava Taşımacılığı", sector: "Ulaşım" },
  { symbol: "TAVHL", name: "TAV Havalimanları Holding", sector: "Ulaşım" },
  { symbol: "BIMAS", name: "BİM Birleşik Mağazalar A.Ş.", sector: "Perakende" },
  { symbol: "BINHO", name: "1000 Yatırımlar Holding A.Ş.", sector: "Holding" },
  { symbol: "EBEBK", name: "Ebebek Mağazacılık A.Ş.", sector: "Perakende" },
  { symbol: "ARCLK", name: "Arçelik A.Ş.", sector: "Dayanıklı Tüketim" },
  { symbol: "VESBE", name: "Vestel Beyaz Eşya", sector: "Dayanıklı Tüketim" },
  { symbol: "VESTL", name: "Vestel Elektronik", sector: "Elektronik" },
  { symbol: "MGROS", name: "Migros Ticaret A.Ş.", sector: "Perakende" },
  { symbol: "SOKM",  name: "Şok Marketler Ticaret", sector: "Perakende" },
  { symbol: "HALKB", name: "Halkbank A.Ş.", sector: "Bankacılık" },
  { symbol: "VAKBN", name: "Vakıfbank A.Ş.", sector: "Bankacılık" },
  { symbol: "ZOREN", name: "Zorlu Enerji", sector: "Enerji" },
  { symbol: "ENKAI", name: "Enka İnşaat ve Sanayi", sector: "İnşaat" },
  { symbol: "PETKM", name: "Petkim Petrokimya Holding", sector: "Kimya" },
  { symbol: "EREGL", name: "Ereğli Demir Çelik", sector: "Metal" },
  { symbol: "KRDMD", name: "Kardemir Karabük Demir", sector: "Metal" },
  { symbol: "DOHOL", name: "Doğan Holding", sector: "Holding" },
  { symbol: "NTHOL", name: "Net Holding A.Ş.", sector: "Holding" },
  { symbol: "BRISA", name: "Brisa Bridgestone Sabancı", sector: "Otomotiv" },
  { symbol: "OTKAR", name: "Otokar Otomotiv ve Savunma", sector: "Otomotiv" },
  { symbol: "LOGO",  name: "Logo Yazılım Sanayi", sector: "Yazılım" },
  { symbol: "NETAS", name: "Netaş Telekomünikasyon", sector: "Telekom" },
  { symbol: "ASELS", name: "Aselsan Elektronik", sector: "Savunma" },
  { symbol: "ROBIT", name: "Robit Savunma", sector: "Savunma" },
  { symbol: "KOZAL", name: "Koza Altın İşletmeleri", sector: "Madencilik" },
  { symbol: "IPEKE", name: "İpek Enerji Üretim", sector: "Enerji" },
];
const POPULAR = ["THYAO","TUPRS","TCELL","AKBNK","GARAN","SISE","ISCTR","KCHOL","TOASO","PGSUS","TAVHL","EKGYO"];
const DEFAULT_STOCKS = [
  { symbol: "BIMAS", yahoo: "BIMAS.IS", name: "BİM Birleşik Mağazalar A.Ş.", sector: "Perakende" },
  { symbol: "BINHO", yahoo: "BINHO.IS", name: "1000 Yatırımlar Holding A.Ş.", sector: "Holding" },
  { symbol: "EBEBK", yahoo: "EBEBK.IS", name: "Ebebek Mağazacılık A.Ş.", sector: "Perakende" },
];

function bistToYahoo(symbol) { return symbol.toUpperCase() + ".IS"; }
function bisListLookup(symbol) {
  return BIST_LIST.find((s) => s.symbol === symbol.toUpperCase()) || {
    symbol: symbol.toUpperCase(), name: symbol.toUpperCase(), sector: "BIST",
  };
}

/* ────────────────────────────────────────────────────────────────
   localStorage helpers
   ────────────────────────────────────────────────────────────── */
function lsGet(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

/* ────────────────────────────────────────────────────────────────
   İndikatör Matematiği
   ────────────────────────────────────────────────────────────── */
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
  for (let i = 0; i < closes.length; i++) {
    if (i === period - 1) {
      let s = 0; for (let j = 0; j <= i; j++) s += closes[j];
      out[i] = s / period;
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
      avgGain += gain / period; avgLoss += loss / period;
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
  const fast = emaSeries(closes, 12), slow = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (fast[i] != null && slow[i] != null ? fast[i] - slow[i] : null));
  const validStart = macdLine.findIndex((v) => v != null);
  const compact = macdLine.slice(validStart);
  const signalCompact = emaSeries(compact, 9);
  const signalLine = new Array(closes.length).fill(null);
  for (let i = 0; i < signalCompact.length; i++) {
    if (signalCompact[i] != null) signalLine[validStart + i] = signalCompact[i];
  }
  const hist = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i] - signalLine[i] : null
  );
  return { macdLine, signalLine, hist };
}

function bollingerSeries(closes, period = 20, k = 2) {
  const sma = smaSeries(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper[i] = mean + k * std;
    lower[i] = mean - k * std;
  }
  return { sma, upper, lower };
}

function clip(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function indicatorSignals(i, closes, sma20, sma50, rsi, macd, bollinger, newsSentiment) {
  let sRsi = 0, sMacd = 0, sMa = 0, sBoll = 0, sNews = 0;
  if (rsi[i] != null) sRsi = clip(-(rsi[i] - 50) / 35, -1, 1);
  if (macd.hist[i] != null) {
    const window = macd.hist.slice(Math.max(0, i - 30), i + 1).filter((v) => v != null).map(Math.abs);
    const scale = Math.max(...window, 1e-6);
    sMacd = clip(macd.hist[i] / scale, -1, 1);
  }
  if (sma20[i] != null && sma50[i] != null) {
    const p = closes[i];
    if (p > sma20[i] && sma20[i] > sma50[i]) sMa = 1;
    else if (p < sma20[i] && sma20[i] < sma50[i]) sMa = -1;
    else if (p > sma20[i]) sMa = 0.5;
    else sMa = -0.5;
  }
  if (bollinger.upper[i] != null && bollinger.lower[i] != null) {
    const band = bollinger.upper[i] - bollinger.lower[i];
    if (band > 0) {
      const pos = (closes[i] - bollinger.lower[i]) / band; // 0..1
      sBoll = clip(-(pos - 0.5) * 2, -1, 1); // lower=AL, upper=SAT
    }
  }
  // Haber sentimenti statik (son analiz anında): aynı değer tüm seriye uygulanır
  sNews = clip(newsSentiment || 0, -1, 1);
  return { sRsi, sMacd, sMa, sBoll, sNews };
}

function learnWeights(closes, sma20, sma50, rsi, macd, bollinger, warmup, newsSentiment = 0) {
  const edges = { rsi: [], macd: [], ma: [], boll: [], news: [] };
  for (let i = warmup; i < closes.length - 1; i++) {
    const { sRsi, sMacd, sMa, sBoll, sNews } = indicatorSignals(i, closes, sma20, sma50, rsi, macd, bollinger, newsSentiment);
    const nextRet = (closes[i + 1] - closes[i]) / closes[i];
    edges.rsi.push([sRsi, nextRet]);
    edges.macd.push([sMacd, nextRet]);
    edges.ma.push([sMa, nextRet]);
    edges.boll.push([sBoll, nextRet]);
    edges.news.push([sNews, nextRet]);
  }
  function edgeScore(pairs) {
    const pos = pairs.filter((p) => p[0] > 0.15).map((p) => p[1]);
    const neg = pairs.filter((p) => p[0] < -0.15).map((p) => p[1]);
    if (!pos.length || !neg.length) return 0.1;
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    return Math.max(avg(pos) - avg(neg), 0.01);
  }
  const eR = edgeScore(edges.rsi), eM = edgeScore(edges.macd),
        eA = edgeScore(edges.ma), eB = edgeScore(edges.boll),
        eN = edgeScore(edges.news);
  const total = eR + eM + eA + eB + eN || 1;
  return { wRsi: eR / total, wMacd: eM / total, wMa: eA / total, wBoll: eB / total, wNews: eN / total };
}

function scoreSeries(closes, sma20, sma50, rsi, macd, bollinger, weights, newsSentiment = 0) {
  return closes.map((_, i) => {
    const { sRsi, sMacd, sMa, sBoll, sNews } = indicatorSignals(i, closes, sma20, sma50, rsi, macd, bollinger, newsSentiment);
    const raw = weights.wRsi * sRsi + weights.wMacd * sMacd + weights.wMa * sMa +
                weights.wBoll * sBoll + weights.wNews * sNews;
    return Math.round(clip(raw * 100, -100, 100));
  });
}

function signalFromScore(score) {
  if (score >= 25) return "AL";
  if (score <= -25) return "SAT";
  return "BEKLE";
}

function backtest(closes, dates, scores, warmup, startTL) {
  let cash = startTL, shares = 0, inPosition = false;
  const buyHold = { shares: startTL / closes[warmup] };
  const curve = [];
  for (let i = warmup; i < closes.length; i++) {
    const sig = signalFromScore(scores[i]);
    if (sig === "AL" && !inPosition) { shares = cash / closes[i]; cash = 0; inPosition = true; }
    else if (sig === "SAT" && inPosition) { cash = shares * closes[i]; shares = 0; inPosition = false; }
    curve.push({ date: dates[i], value: inPosition ? shares * closes[i] : cash });
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

/* ────────────────────────────────────────────────────────────────
   Veri çekme
   ────────────────────────────────────────────────────────────── */
async function fetchStockHistory(yahooSymbol) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(yahooSymbol)}`);
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
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
  try { const r = await fetch("/api/fx"); if (!r.ok) return null; const j = await r.json(); return j?.rate || null; }
  catch { return null; }
}

async function fetchNews(yahooSymbol) {
  try {
    const r = await fetch(`/api/news?symbol=${encodeURIComponent(yahooSymbol)}`);
    if (!r.ok) return { items: [], avgSentiment: 0 };
    return await r.json();
  } catch { return { items: [], avgSentiment: 0 }; }
}

function generateDemoHistory(basePrice, days = 260) {
  const closes = [], dates = [];
  let price = basePrice;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    price = Math.max(price * (1 + 0.0002 + (Math.random() - 0.5) * 0.028), 0.5);
    closes.push(Number(price.toFixed(2)));
    const d = new Date(now); d.setDate(d.getDate() - i); dates.push(d);
  }
  return { closes, dates, currency: "TRY", prevClose: closes[closes.length - 2] };
}

/* ────────────────────────────────────────────────────────────────
   packageHistory — tüm indikatörleri hesapla
   ────────────────────────────────────────────────────────────── */
function packageHistory(hist, newsSentiment = 0) {
  const { closes, dates } = hist;
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const rsi = rsiSeries(closes, 14);
  const macd = macdSeries(closes);
  const bollinger = bollingerSeries(closes, 20, 2);
  const warmup = 50;
  const weights = learnWeights(closes, sma20, sma50, rsi, macd, bollinger, warmup, newsSentiment);
  const scores = scoreSeries(closes, sma20, sma50, rsi, macd, bollinger, weights, newsSentiment);
  const last = closes.length - 1;
  const price = closes[last];
  const prevClose = hist.prevClose ?? closes[last - 1];
  const changePct = ((price - prevClose) / prevClose) * 100;
  const maTrend = sma20[last] > sma50[last] ? "Yükseliş" : sma20[last] < sma50[last] ? "Düşüş" : "Yatay";
  const bollPos = bollinger.upper[last] != null
    ? (closes[last] - bollinger.lower[last]) / (bollinger.upper[last] - bollinger.lower[last])
    : 0.5;
  const bollLabel = bollPos > 0.8 ? "Üst banda yakın" : bollPos < 0.2 ? "Alt banda yakın" : "Orta bant yakın";
  return {
    closes, dates, sma20, sma50, rsi: rsi[last], rsiSeries: rsi,
    macdHist: macd.hist[last], macd,
    bollinger, bollPos, bollLabel,
    score: scores[last], scoreSeries: scores,
    signal: signalFromScore(scores[last]),
    price, changePct, maTrend, weights, warmup,
    newsSentiment,
  };
}

/* ────────────────────────────────────────────────────────────────
   Küçük UI bileşenleri
   ────────────────────────────────────────────────────────────── */
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
  const angle = (clip(score, -100, 100) / 100) * 90;
  const needleColor = score >= 25 ? C.green : score <= -25 ? C.red : C.amber;
  const r = 46, cx = 54, cy = 54;
  const arc = (startDeg, endDeg, col) => {
    const toRad = (d) => ((d - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg)), y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg)), y2 = cy + r * Math.sin(toRad(endDeg));
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`}
      stroke={col} strokeWidth="8" fill="none" strokeLinecap="round" />;
  };
  const needleRad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + (r - 10) * Math.cos(needleRad), ny = cy + (r - 10) * Math.sin(needleRad);
  return (
    <svg width="108" height="66" viewBox="0 0 108 66">
      {arc(0, 60, C.red)} {arc(60, 120, C.amber)} {arc(120, 180, C.green)}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill={needleColor} />
    </svg>
  );
}

function SignalBadge({ signal, size = "sm" }) {
  const cfg = {
    AL:    { bg: "rgba(52,211,153,0.14)",  fg: C.green, Icon: TrendingUp,   label: "AL" },
    SAT:   { bg: "rgba(251,91,77,0.14)",   fg: C.red,   Icon: TrendingDown, label: "SAT" },
    BEKLE: { bg: "rgba(245,166,35,0.14)",  fg: C.amber, Icon: Minus,        label: "BEKLE" },
  }[signal];
  const Icon = cfg.Icon;
  const cls = size === "lg"
    ? "font-mono inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold tracking-wide"
    : "font-mono inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide";
  return (
    <span className={cls} style={{ background: cfg.bg, color: cfg.fg }}>
      <Icon size={size === "lg" ? 15 : 13} strokeWidth={2.5} /> {cfg.label}
    </span>
  );
}

function IndicatorBar({ label, value, sub, barPct, color, extra }) {
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-body text-xs" style={{ color: C.muted }}>{label}</span>
        <div className="flex items-center gap-2">
          {extra}
          <span className="font-mono text-sm" style={{ color: C.text }}>{value}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.panelAlt }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${clip(barPct, 0, 100)}%`, background: color }} />
      </div>
      {sub && <div className="font-body text-[11px] mt-1" style={{ color: C.faint }}>{sub}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Hedef fiyat bileşeni (düzenlenebilir)
   ────────────────────────────────────────────────────────────── */
function PriceTarget({ label, color, bg, value, onChange, currentPrice }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);

  const handleEdit = () => { setDraft(value || ""); setEditing(true); };
  const handleSave = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onChange(n.toFixed(2));
    setEditing(false);
  };

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const hit = value && currentPrice
    ? (label === "AL" ? currentPrice >= parseFloat(value)
      : label === "SAT" ? currentPrice <= parseFloat(value)
      : false)
    : false;

  return (
    <div className="rounded-lg p-3 mb-2" style={{ background: bg, border: `1px solid ${color}33` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs font-semibold" style={{ color }}>{label}</span>
        {hit && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: color + "33", color }}>⚡ HEDEF</span>}
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="font-mono text-sm w-full rounded px-2 py-1 sm-focus"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
          />
          <button onClick={handleSave} className="sm-focus p-1 rounded" style={{ color: C.green }}>
            <Check size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-mono text-lg font-semibold" style={{ color: C.text }}>
            {value ? `${value} TL` : <span style={{ color: C.faint }}>—</span>}
          </span>
          <button onClick={handleEdit} className="sm-focus p-1 rounded hover:opacity-80" style={{ color: C.faint }}>
            <Edit3 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Haber paneli
   ────────────────────────────────────────────────────────────── */
function NewsPanel({ news, loading }) {
  if (loading) return (
    <div className="flex items-center gap-2 py-4 font-body text-xs" style={{ color: C.muted }}>
      <RefreshCw size={12} className="animate-spin" /> Haberler yükleniyor…
    </div>
  );
  if (!news || !news.items?.length) return (
    <div className="font-body text-xs py-3" style={{ color: C.faint }}>
      Bu hisse için güncel haber bulunamadı.
    </div>
  );

  const sent = news.avgSentiment;
  const sentColor = sent > 0.1 ? C.green : sent < -0.1 ? C.red : C.amber;
  const sentLabel = sent > 0.1 ? "Pozitif" : sent < -0.1 ? "Negatif" : "Nötr";

  function timeAgo(pubDate) {
    if (!pubDate) return "";
    const d = new Date(pubDate);
    const diff = (Date.now() - d) / 1000;
    if (diff < 3600) return `${Math.round(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.round(diff / 3600)} saat önce`;
    return `${Math.round(diff / 86400)} gün önce`;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold"
          style={{ background: sentColor + "22", color: sentColor }}>
          {sentLabel} {sent > 0 ? "+" : ""}{sent.toFixed(2)}
        </span>
        <span className="font-body text-[11px]" style={{ color: C.faint }}>Ortalama haber sentimenti</span>
      </div>
      <div className="space-y-2">
        {news.items.map((item, idx) => {
          const sc = item.sentiment;
          const ic = sc > 0.1 ? C.green : sc < -0.1 ? C.red : C.amber;
          return (
            <div key={idx} className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-body text-xs leading-snug" style={{ color: C.text }}>{item.title}</p>
                <span className="font-mono text-[10px] shrink-0 px-1 py-0.5 rounded"
                  style={{ background: ic + "22", color: ic }}>
                  {sc > 0 ? "+" : ""}{sc.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {item.source && <span className="font-body text-[10px]" style={{ color: C.faint }}>{item.source}</span>}
                <span className="font-body text-[10px]" style={{ color: C.faint }}>{timeAgo(item.pubDate)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Detay sayfası
   ────────────────────────────────────────────────────────────── */
function DetailPage({ stock, data, usdTry, news, newsLoading, targets, onTargetChange, portfolio, onPortfolioChange, onClose }) {
  const [btAmount, setBtAmount] = useState(10000);
  const [activeTab, setActiveTab] = useState("indicators");

  const bt = useMemo(
    () => data ? backtest(data.closes, data.dates, data.scoreSeries, data.warmup, Math.max(btAmount, 1)) : null,
    [data, btAmount]
  );

  if (!data) return null;

  const tabs = [
    { id: "indicators", label: "İndikatörler" },
    { id: "news", label: "Haberler" },
    { id: "portfolio", label: "Portföy" },
    { id: "backtest", label: "Simülasyon" },
  ];

  const tgt = targets[stock.symbol] || {};
  const pf = portfolio[stock.symbol] || { lots: "", cost: "" };

  const pfPnl = pf.lots && pf.cost
    ? (data.price - parseFloat(pf.cost)) * parseFloat(pf.lots)
    : null;
  const pfPnlPct = pf.cost && parseFloat(pf.cost) > 0
    ? ((data.price - parseFloat(pf.cost)) / parseFloat(pf.cost)) * 100
    : null;

  return (
    <div className="detail-overlay font-body" style={{ background: C.bg }}>
      <style>{FONT_STYLE}</style>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <button onClick={onClose} className="sm-focus mt-1 p-1.5 rounded-lg hover:opacity-80"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-xl font-bold" style={{ color: C.text }}>{stock.symbol}</h1>
                <SignalBadge signal={data.signal} size="lg" />
              </div>
              <p className="font-body text-xs mt-0.5" style={{ color: C.muted }}>
                {stock.name} · {stock.sector}
              </p>
            </div>
          </div>
        </div>

        {/* Fiyat */}
        <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {data.isDemo && (
            <div className="font-mono text-[10px] tracking-wide mb-2 px-2 py-0.5 rounded inline-block"
              style={{ background: "rgba(245,166,35,0.14)", color: C.amber }}>ÖRNEK VERİ</div>
          )}
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="font-mono text-3xl font-semibold" style={{ color: C.text }}>
                {data.price.toFixed(2)} <span className="text-base font-normal" style={{ color: C.muted }}>TRY</span>
              </div>
              <div className="font-mono text-sm mt-0.5" style={{ color: data.changePct >= 0 ? C.green : C.red }}>
                {data.changePct >= 0 ? "▲" : "▼"} %{Math.abs(data.changePct).toFixed(2)}
              </div>
              {usdTry && (
                <div className="font-mono text-xs mt-1" style={{ color: C.faint }}>
                  ≈ ${(data.price / usdTry).toFixed(2)} USD
                </div>
              )}
            </div>
            <Sparkline closes={data.closes.slice(-60)} color={data.changePct >= 0 ? C.green : C.red} />
          </div>
        </div>

        {/* AL/SAT Hedefleri */}
        <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <h2 className="font-display text-sm font-semibold mb-3" style={{ color: C.text }}>AL / BEKLE / SAT Hedefleri</h2>
          <div className="grid grid-cols-1 gap-0">
            <PriceTarget
              label="AL"
              color={C.green}
              bg="rgba(52,211,153,0.06)"
              value={tgt.buy}
              onChange={(v) => onTargetChange(stock.symbol, "buy", v)}
              currentPrice={data.price}
            />
            <PriceTarget
              label="BEKLE (üst)"
              color={C.amber}
              bg="rgba(245,166,35,0.06)"
              value={tgt.waitUpper}
              onChange={(v) => onTargetChange(stock.symbol, "waitUpper", v)}
              currentPrice={null}
            />
            <PriceTarget
              label="SAT"
              color={C.red}
              bg="rgba(251,91,77,0.06)"
              value={tgt.sell}
              onChange={(v) => onTargetChange(stock.symbol, "sell", v)}
              currentPrice={data.price}
            />
          </div>
          <p className="font-body text-[10px] mt-2" style={{ color: C.faint }}>
            ✏ Fiyata tıklayarak düzenle · Enter veya ✓ ile kaydet
          </p>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="sm-focus font-mono text-xs px-3 py-2 rounded-lg shrink-0"
              style={{
                background: activeTab === tab.id ? C.amber + "22" : C.panelAlt,
                color: activeTab === tab.id ? C.amber : C.muted,
                border: `1px solid ${activeTab === tab.id ? C.amber + "55" : C.border}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sekme içerikleri */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>

          {/* İndikatörler */}
          {activeTab === "indicators" && (
            <div>
              <IndicatorBar
                label="RSI (14)"
                value={data.rsi != null ? data.rsi.toFixed(1) : "—"}
                sub={data.rsi != null ? (data.rsi < 30 ? "Aşırı satım — alım fırsatı olabilir" : data.rsi > 70 ? "Aşırı alım — dikkatli ol" : "Nötr bölge") : ""}
                barPct={data.rsi ?? 50}
                color={data.rsi < 30 ? C.green : data.rsi > 70 ? C.red : C.amber}
              />
              <IndicatorBar
                label="MACD Histogram"
                value={data.macdHist != null ? data.macdHist.toFixed(3) : "—"}
                sub={data.macdHist != null ? (data.macdHist > 0 ? "Momentum yukarı yönlü" : "Momentum aşağı yönlü") : ""}
                barPct={data.macdHist != null ? 50 + clip(data.macdHist * 200, -50, 50) : 50}
                color={data.macdHist > 0 ? C.green : C.red}
              />
              <IndicatorBar
                label="Hareketli Ortalama (20/50)"
                value={data.maTrend}
                sub="Fiyatın kısa ve uzun vadeli ortalamaya göre konumu"
                barPct={data.maTrend === "Yükseliş" ? 80 : data.maTrend === "Düşüş" ? 20 : 50}
                color={data.maTrend === "Yükseliş" ? C.green : data.maTrend === "Düşüş" ? C.red : C.amber}
              />
              <IndicatorBar
                label="Bollinger Bands"
                value={data.bollLabel}
                sub={`Bant içi konum: %${(data.bollPos * 100).toFixed(0)} — ${data.bollPos > 0.8 ? "aşırı alım yakını" : data.bollPos < 0.2 ? "aşırı satım yakını" : "orta bant"}`}
                barPct={data.bollPos * 100}
                color={data.bollPos > 0.8 ? C.red : data.bollPos < 0.2 ? C.green : C.amber}
              />
              <IndicatorBar
                label="Haber Sentimenti"
                value={data.newsSentiment > 0 ? `+${data.newsSentiment.toFixed(2)}` : data.newsSentiment.toFixed(2)}
                sub={data.newsSentiment > 0.1 ? "Haberler genel olarak olumlu" : data.newsSentiment < -0.1 ? "Haberler genel olarak olumsuz" : "Haberler nötr"}
                barPct={50 + data.newsSentiment * 50}
                color={data.newsSentiment > 0.1 ? C.green : data.newsSentiment < -0.1 ? C.red : C.amber}
              />

              {/* Sinyal skoru */}
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-body text-xs" style={{ color: C.muted }}>Birleşik Sinyal Skoru</span>
                  <span className="font-mono text-sm font-semibold" style={{ color: C.text }}>{data.score}/100</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.panelAlt }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${50 + data.score / 2}%`,
                      background: data.score >= 25 ? C.green : data.score <= -25 ? C.red : C.amber,
                    }} />
                </div>
              </div>

              {/* Adaptif ağırlıklar */}
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <p className="font-body text-[11px] mb-2" style={{ color: C.faint }}>Adaptif ağırlıklar (geçmiş veri bazlı öğrenim):</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["RSI", data.weights.wRsi],
                    ["MACD", data.weights.wMacd],
                    ["MA", data.weights.wMa],
                    ["Bollinger", data.weights.wBoll],
                    ["Haber", data.weights.wNews],
                  ].map(([lbl, w]) => (
                    <span key={lbl} className="font-mono text-[11px] px-2 py-0.5 rounded"
                      style={{ background: C.panelAlt, color: C.muted }}>
                      {lbl} %{Math.round(w * 100)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Haberler */}
          {activeTab === "news" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Newspaper size={15} style={{ color: C.amber }} />
                <span className="font-display text-sm font-semibold" style={{ color: C.text }}>
                  Güncel Haberler — {stock.symbol}
                </span>
              </div>
              <NewsPanel news={news} loading={newsLoading} />
            </div>
          )}

          {/* Portföy */}
          {activeTab === "portfolio" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={15} style={{ color: C.amber }} />
                <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Portföy Girişi</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Lot / Adet</label>
                  <input
                    type="number"
                    min={0}
                    value={pf.lots}
                    onChange={(e) => onPortfolioChange(stock.symbol, "lots", e.target.value)}
                    className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Ortalama Maliyet (TL)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={pf.cost}
                    onChange={(e) => onPortfolioChange(stock.symbol, "cost", e.target.value)}
                    className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
                    placeholder="450.00"
                  />
                </div>
              </div>
              {pfPnl !== null && (
                <div className="rounded-lg p-4" style={{ background: C.panelAlt }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="font-body text-[11px]" style={{ color: C.faint }}>Kâr / Zarar</div>
                      <div className="font-mono text-xl mt-1 font-semibold" style={{ color: pfPnl >= 0 ? C.green : C.red }}>
                        {pfPnl >= 0 ? "+" : ""}{pfPnl.toFixed(2)} TL
                      </div>
                    </div>
                    <div>
                      <div className="font-body text-[11px]" style={{ color: C.faint }}>Getiri %</div>
                      <div className="font-mono text-xl mt-1 font-semibold" style={{ color: pfPnlPct >= 0 ? C.green : C.red }}>
                        {pfPnlPct >= 0 ? "+" : ""}{pfPnlPct?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 flex justify-between text-[11px] font-mono" style={{ borderTop: `1px solid ${C.border}`, color: C.faint }}>
                    <span>{pf.lots} lot × {data.price.toFixed(2)} TL</span>
                    <span>Toplam: {(parseFloat(pf.lots) * data.price).toFixed(2)} TL</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Simülasyon */}
          {activeTab === "backtest" && bt && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={15} style={{ color: C.amber }} />
                <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Geriye Dönük Simülasyon</span>
              </div>
              <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Başlangıç tutarı (TL)</label>
              <input
                type="number"
                min={1}
                value={btAmount}
                onChange={(e) => setBtAmount(Number(e.target.value) || 1)}
                className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm mb-4"
                style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
                  <div className="font-body text-[11px]" style={{ color: C.faint }}>Strateji sonucu</div>
                  <div className="font-mono text-lg mt-1" style={{ color: bt.returnPct >= 0 ? C.green : C.red }}>
                    {bt.finalValue.toFixed(2)} TL
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: bt.returnPct >= 0 ? C.green : C.red }}>
                    {bt.returnPct >= 0 ? "+" : ""}{bt.returnPct.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
                  <div className="font-body text-[11px]" style={{ color: C.faint }}>Al-ve-tut kıyası</div>
                  <div className="font-mono text-lg mt-1" style={{ color: bt.buyHoldReturnPct >= 0 ? C.green : C.red }}>
                    {bt.buyHoldFinal.toFixed(2)} TL
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: bt.buyHoldReturnPct >= 0 ? C.green : C.red }}>
                    {bt.buyHoldReturnPct >= 0 ? "+" : ""}{bt.buyHoldReturnPct.toFixed(2)}%
                  </div>
                </div>
              </div>
              <p className="font-body text-[11px] mt-3" style={{ color: C.faint }}>
                Son ~1 yıllık geçmiş üzerinden, sinyal değişiminde tüm bakiye al/sat varsayımıyla hesaplanır. İşlem maliyeti içermez. Geçmiş performans gelecek garantisi değildir.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   BIST hisse ekleme modalı
   ────────────────────────────────────────────────────────────── */
function AddStockModal({ existingSymbols, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const q = query.trim().toUpperCase();
  const filtered = q
    ? BIST_LIST.filter((s) => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q))
    : BIST_LIST.slice(0, 20);

  // Serbest sembol girişi
  const canAddCustom = q.length >= 2 && !BIST_LIST.find((s) => s.symbol === q) && !existingSymbols.includes(q);

  const addStock = (symbol) => {
    const info = bisListLookup(symbol);
    onAdd({ symbol: info.symbol, yahoo: bistToYahoo(info.symbol), name: info.name, sector: info.sector });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <style>{FONT_STYLE}</style>
      <div className="rounded-xl w-full max-w-sm mx-4 overflow-hidden font-body"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-display text-sm font-semibold" style={{ color: C.text }}>BIST Hisse Ara</span>
          <button onClick={onClose} className="sm-focus p-1 rounded hover:opacity-80" style={{ color: C.muted }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
            <Search size={14} style={{ color: C.faint }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hisse kodu veya şirket adı…"
              className="font-mono text-sm bg-transparent outline-none w-full"
              style={{ color: C.text }}
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-64 px-2 pb-2">
          {filtered.map((s) => {
            const already = existingSymbols.includes(s.symbol);
            return (
              <button
                key={s.symbol}
                onClick={() => !already && addStock(s.symbol)}
                disabled={already}
                className="w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between sm-focus"
                style={{ opacity: already ? 0.4 : 1, cursor: already ? "default" : "pointer" }}
              >
                <div>
                  <span className="font-mono text-sm font-semibold" style={{ color: C.text }}>{s.symbol}</span>
                  <span className="font-body text-xs ml-2" style={{ color: C.muted }}>{s.name}</span>
                </div>
                <span className="font-body text-[11px] shrink-0 ml-2" style={{ color: C.faint }}>{s.sector}</span>
              </button>
            );
          })}
          {canAddCustom && (
            <button
              onClick={() => addStock(q)}
              className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 sm-focus mt-1"
              style={{ border: `1px dashed ${C.border}` }}
            >
              <Plus size={13} style={{ color: C.amber }} />
              <span className="font-mono text-sm" style={{ color: C.amber }}>"{q}" ekle</span>
              <span className="font-body text-xs" style={{ color: C.faint }}>({q}.IS)</span>
            </button>
          )}
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="font-body text-[11px] mb-2" style={{ color: C.faint }}>Popüler:</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR.filter((p) => !existingSymbols.includes(p)).map((p) => (
              <button
                key={p}
                onClick={() => addStock(p)}
                className="font-mono text-[11px] px-2 py-0.5 rounded sm-focus hover:opacity-80"
                style={{ background: C.panelAlt, color: C.text, border: `1px solid ${C.border}` }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Hisse kartı
   ────────────────────────────────────────────────────────────── */
function StockCard({ stock, data, status, error, onRetry, onDemo, onSelect, onRemove, usdTry, targets }) {
  const tgt = targets[stock.symbol] || {};

  const targetLine = () => {
    if (!data) return null;
    if (data.signal === "AL" && tgt.buy) {
      return <span className="font-mono text-[11px]" style={{ color: C.green }}>Alım hedefi: {tgt.buy} TL</span>;
    }
    if (data.signal === "BEKLE" && tgt.waitUpper) {
      return <span className="font-mono text-[11px]" style={{ color: C.amber }}>Bekle ≤ {tgt.waitUpper} TL</span>;
    }
    if (data.signal === "SAT" && tgt.sell) {
      return <span className="font-mono text-[11px]" style={{ color: C.red }}>Satış hedefi: {tgt.sell} TL</span>;
    }
    return null;
  };

  return (
    <div className="rounded-xl p-4 transition-colors relative group"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {/* Kaldır butonu */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(stock.symbol); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 sm-focus p-1 rounded transition-opacity"
        style={{ color: C.faint }}
        title="Listeden kaldır"
      >
        <X size={12} />
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="font-display font-semibold text-lg tracking-tight" style={{ color: C.text }}>{stock.symbol}</div>
          <div className="font-body text-xs mt-0.5" style={{ color: C.muted }}>{stock.sector}</div>
        </div>
        {data && <Gauge score={data.score} />}
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 mt-4 mb-2 font-body text-xs" style={{ color: C.muted }}>
          <RefreshCw size={13} className="animate-spin" /> Yükleniyor…
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 mb-1">
          <div className="flex items-center gap-2 font-body text-xs mb-2" style={{ color: C.red }}>
            <AlertTriangle size={13} /> {error || "Veri alınamadı"}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onRetry(stock.symbol)}
              className="font-mono text-xs px-2.5 py-1 rounded-md sm-focus"
              style={{ border: `1px solid ${C.border}`, color: C.text }}>Tekrar</button>
            <button onClick={() => onDemo(stock.symbol)}
              className="font-mono text-xs px-2.5 py-1 rounded-md sm-focus"
              style={{ border: `1px solid ${C.amber}`, color: C.amber }}>Örnek veri</button>
          </div>
        </div>
      )}

      {status === "ready" && data && (
        <>
          {data.isDemo && (
            <div className="font-mono text-[10px] tracking-wide mt-2 px-2 py-0.5 rounded inline-block"
              style={{ background: "rgba(245,166,35,0.14)", color: C.amber }}>ÖRNEK VERİ</div>
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
                <div className="font-mono text-[11px] mt-0.5" style={{ color: C.faint }}>
                  ≈ ${(data.price / usdTry).toFixed(2)} USD
                </div>
              )}
            </div>
            <Sparkline closes={data.closes.slice(-40)} color={data.changePct >= 0 ? C.green : C.red} />
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex flex-col gap-1">
              <SignalBadge signal={data.signal} />
              {targetLine()}
            </div>
            <button
              onClick={() => onSelect(stock.symbol)}
              className="sm-focus inline-flex items-center gap-1 font-body text-xs hover:opacity-80"
              style={{ color: C.faint }}
            >
              Detay <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Ticker şeridi
   ────────────────────────────────────────────────────────────── */
function TickerStrip({ items, usdTry }) {
  const content = items.filter((it) => it.data);
  if (!content.length) return null;
  const row = (kp) => (
    <div className="flex items-center gap-8 pr-8">
      {content.map((it) => (
        <span key={kp + it.stock.symbol} className="font-mono text-xs whitespace-nowrap flex items-center gap-1.5">
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
        {row("a")}{row("b")}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Portföy özet tablosu
   ────────────────────────────────────────────────────────────── */
function PortfolioSummary({ items, portfolio, onSelectStock }) {
  const rows = items.filter((it) => it.data && portfolio[it.stock.symbol]?.lots && portfolio[it.stock.symbol]?.cost);
  if (!rows.length) return null;

  return (
    <div className="rounded-xl overflow-hidden mt-5" style={{ border: `1px solid ${C.border}` }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: C.panelAlt, borderBottom: `1px solid ${C.border}` }}>
        <Briefcase size={14} style={{ color: C.amber }} />
        <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Portföyüm</span>
      </div>
      <div style={{ background: C.panel }}>
        {rows.map(({ stock, data }) => {
          const pf = portfolio[stock.symbol];
          const lots = parseFloat(pf.lots);
          const cost = parseFloat(pf.cost);
          const pnl = (data.price - cost) * lots;
          const pnlPct = ((data.price - cost) / cost) * 100;
          return (
            <button
              key={stock.symbol}
              onClick={() => onSelectStock(stock.symbol)}
              className="w-full flex items-center justify-between px-4 py-3 sm-focus hover:opacity-80 text-left"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold" style={{ color: C.text }}>{stock.symbol}</span>
                <span className="font-mono text-xs" style={{ color: C.faint }}>{lots} lot @ {cost.toFixed(2)} TL</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm" style={{ color: pnl >= 0 ? C.green : C.red }}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} TL
                  </div>
                  <div className="font-mono text-xs" style={{ color: pnl >= 0 ? C.green : C.red }}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </div>
                </div>
                <SignalBadge signal={data.signal} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Ana uygulama
   ────────────────────────────────────────────────────────────── */
export default function SinyalMasasi() {
  // Hisse listesi localStorage'dan
  const [stocks, setStocks] = useState(() => {
    const saved = lsGet("sm_stocks", null);
    if (saved && Array.isArray(saved) && saved.length > 0) return saved;
    return DEFAULT_STOCKS;
  });

  const [statusMap, setStatusMap] = useState({});
  const [dataMap, setDataMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [newsMap, setNewsMap] = useState({});
  const [newsLoadingMap, setNewsLoadingMap] = useState({});
  const [usdTry, setUsdTry] = useState(null);
  const [detailSymbol, setDetailSymbol] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Hedef fiyatlar localStorage'dan
  const [targets, setTargets] = useState(() => lsGet("sm_targets", {}));
  // Portföy localStorage'dan
  const [portfolio, setPortfolio] = useState(() => lsGet("sm_portfolio", {}));

  const mounted = useRef(true);

  // Stocks değiştikçe kaydet
  useEffect(() => { lsSet("sm_stocks", stocks); }, [stocks]);
  // Targets değiştikçe kaydet
  useEffect(() => { lsSet("sm_targets", targets); }, [targets]);
  // Portfolio değiştikçe kaydet
  useEffect(() => { lsSet("sm_portfolio", portfolio); }, [portfolio]);

  const handleTargetChange = (symbol, key, value) => {
    setTargets((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] || {}), [key]: value } }));
  };

  const handlePortfolioChange = (symbol, key, value) => {
    setPortfolio((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] || {}), [key]: value } }));
  };

  const packageAndStore = useCallback((symbol, hist, newsSentiment = 0, isDemo = false) => {
    const packaged = { ...packageHistory(hist, newsSentiment), isDemo };
    if (!mounted.current) return;
    setDataMap((m) => ({ ...m, [symbol]: packaged }));
    setStatusMap((m) => ({ ...m, [symbol]: "ready" }));
  }, []);

  const loadNews = useCallback(async (stock) => {
    setNewsLoadingMap((m) => ({ ...m, [stock.symbol]: true }));
    const result = await fetchNews(stock.yahoo);
    if (!mounted.current) return;
    setNewsMap((m) => ({ ...m, [stock.symbol]: result }));
    setNewsLoadingMap((m) => ({ ...m, [stock.symbol]: false }));
    return result?.avgSentiment || 0;
  }, []);

  const loadStock = useCallback(async (stock) => {
    setStatusMap((m) => ({ ...m, [stock.symbol]: "loading" }));
    setErrorMap((m) => ({ ...m, [stock.symbol]: null }));
    try {
      // Hisse verisi ve haberleri paralel çek
      const [hist, newsResult] = await Promise.all([
        fetchStockHistory(stock.yahoo),
        fetchNews(stock.yahoo),
      ]);
      if (!mounted.current) return;
      setNewsMap((m) => ({ ...m, [stock.symbol]: newsResult }));
      setNewsLoadingMap((m) => ({ ...m, [stock.symbol]: false }));
      packageAndStore(stock.symbol, hist, newsResult?.avgSentiment || 0, false);
    } catch (e) {
      if (!mounted.current) return;
      setErrorMap((m) => ({ ...m, [stock.symbol]: e.message || "Veri alınamadı" }));
      setStatusMap((m) => ({ ...m, [stock.symbol]: "error" }));
    }
  }, [packageAndStore]);

  const loadDemo = useCallback((symbol) => {
    const stock = stocks.find((s) => s.symbol === symbol);
    const basePrices = { BIMAS: 490, BINHO: 9.5, EBEBK: 60 };
    const base = basePrices[symbol] || 100;
    const hist = generateDemoHistory(base);
    packageAndStore(symbol, hist, 0, true);
    setErrorMap((m) => ({ ...m, [symbol]: null }));
  }, [stocks, packageAndStore]);

  const loadAll = useCallback(() => {
    stocks.forEach(loadStock);
    fetchUsdTry().then((r) => mounted.current && setUsdTry(r));
    setLastUpdate(new Date());
  }, [stocks, loadStock]);

  useEffect(() => {
    mounted.current = true;
    loadAll();
    const interval = setInterval(loadAll, 5 * 60 * 1000);
    return () => { mounted.current = false; clearInterval(interval); };
  }, [loadAll]);

  const addStock = (newStock) => {
    if (stocks.find((s) => s.symbol === newStock.symbol)) return;
    setStocks((prev) => [...prev, newStock]);
    // Hemen yükle
    setTimeout(() => loadStock(newStock), 50);
  };

  const removeStock = (symbol) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
    setDataMap((m) => { const n = { ...m }; delete n[symbol]; return n; });
    setStatusMap((m) => { const n = { ...m }; delete n[symbol]; return n; });
  };

  const items = stocks.map((stock) => ({ stock, data: dataMap[stock.symbol] }));
  const detailItem = detailSymbol ? items.find((it) => it.stock.symbol === detailSymbol) : null;

  return (
    <div className="min-h-screen font-body" style={{ background: C.bg }}>
      <style>{FONT_STYLE}</style>

      {/* Detay sayfası overlay */}
      {detailItem?.data && (
        <DetailPage
          stock={detailItem.stock}
          data={detailItem.data}
          usdTry={usdTry}
          news={newsMap[detailSymbol]}
          newsLoading={newsLoadingMap[detailSymbol]}
          targets={targets}
          onTargetChange={handleTargetChange}
          portfolio={portfolio}
          onPortfolioChange={handlePortfolioChange}
          onClose={() => setDetailSymbol(null)}
        />
      )}

      {/* Hisse ekleme modalı */}
      {showAddModal && (
        <AddStockModal
          existingSymbols={stocks.map((s) => s.symbol)}
          onAdd={addStock}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Ana dashboard */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Başlık */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: C.text }}>
              🔴 Sinyal Masası
            </h1>
            <p className="font-body text-xs mt-1" style={{ color: C.muted }}>
              BIST teknik analiz & al/sat terminali
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="sm-focus flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg"
              style={{ background: C.amber + "18", border: `1px solid ${C.amber}55`, color: C.amber }}
            >
              <Plus size={13} /> Hisse Ekle
            </button>
            <button
              onClick={loadAll}
              className="sm-focus flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <RefreshCw size={13} /> Yenile
            </button>
          </div>
        </div>

        <TickerStrip items={items} usdTry={usdTry} />

        {/* Uyarı */}
        <div className="rounded-lg px-3.5 py-2.5 mb-5 flex items-start gap-2"
          style={{ background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.25)` }}>
          <AlertTriangle size={14} style={{ color: C.amber, marginTop: 2, flexShrink: 0 }} />
          <p className="font-body text-[11px]" style={{ color: C.amber }}>
            Bu araç yatırım tavsiyesi vermez. Sinyaller teknik göstergelerin otomatik yorumudur. Kararlarınızı kendi araştırmanıza dayandırın.
          </p>
        </div>

        {/* Hisse kartları */}
        <div className={`grid gap-3 ${stocks.length > 3 ? "sm:grid-cols-3 grid-cols-2" : "sm:grid-cols-3"}`}>
          {items.map(({ stock, data }) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              data={data}
              status={statusMap[stock.symbol] || "loading"}
              error={errorMap[stock.symbol]}
              onRetry={(sym) => loadStock(stocks.find((s) => s.symbol === sym))}
              onDemo={loadDemo}
              onSelect={setDetailSymbol}
              onRemove={removeStock}
              usdTry={usdTry}
              targets={targets}
            />
          ))}

          {/* Boş alan — hisse ekle */}
          <button
            onClick={() => setShowAddModal(true)}
            className="sm-focus rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80 min-h-32"
            style={{ border: `2px dashed ${C.border}`, color: C.faint }}
          >
            <Plus size={20} />
            <span className="font-body text-xs">Hisse Ekle</span>
          </button>
        </div>

        {/* Portföy özeti */}
        <PortfolioSummary items={items} portfolio={portfolio} onSelectStock={setDetailSymbol} />

        {lastUpdate && (
          <div className="font-mono text-[11px] text-center mt-5" style={{ color: C.faint }}>
            Son yenileme: {lastUpdate.toLocaleTimeString("tr-TR")} · 5 dk otomatik yenilenir
          </div>
        )}
      </div>
    </div>
  );
}
