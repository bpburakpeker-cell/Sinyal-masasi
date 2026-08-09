import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { loadUserState, saveUserState } from "./lib/persistence";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  ChevronRight, Activity, Plus, Search, X, ArrowLeft,
  Newspaper, Briefcase, Edit3, Check, Info,
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

/* ── Rejim etiketleri (backend pipeline'dan gelen regime alanı için) ── */
const REGIME_LABELS = {
  trend_up:        { label: "Trend Yukarı",    color: "green" },
  trend_down:      { label: "Trend Aşağı",     color: "red"   },
  sideways:        { label: "Yatay Piyasa",    color: "amber" },
  high_volatility: { label: "Yüksek Oynaklık", color: "amber" },
};

/* ── Risk profilleri: aynı analiz skorunu farklı AL/SAT eşiği + onay
   penceresiyle yorumlar. Skor üretimini değil, sadece "ne zaman harekete
   geç" kararını etkiler. confirmDays, api/performance.js'deki onay
   penceresi replay'iyle birebir eşleşir. ── */
const RISK_PROFILES = {
  muhafazakar: { label: "Muhafazakar", buy: 35, sell: -35, confirmDays: 5, desc: "Sadece çok güçlü sinyalde harekete geçer, yanlış alarma karşı sabırlıdır." },
  dengeli:     { label: "Dengeli",     buy: 25, sell: -25, confirmDays: 3, desc: "Sistemin varsayılan dengesi." },
  agresif:     { label: "Agresif",     buy: 15, sell: -15, confirmDays: 1, desc: "Daha sık ve daha erken sinyal üretir, yanlış alarm riski artar." },
};

function signalForProfile(score, profileKey) {
  const p = RISK_PROFILES[profileKey] || RISK_PROFILES.dengeli;
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= p.buy) return "AL";
  if (score <= p.sell) return "SAT";
  return "BEKLE";
}

/* Görünürdeki ana sinyal: backend pipeline verisi varsa (signalData.final_score)
   seçili risk profiline göre yeniden yorumlanır; yoksa eski istemci-taraf
   sinyaline (data.signal) geri düşülür. */
function resolveDisplaySignal(data, signalData, riskProfile) {
  const fromBackend = signalForProfile(signalData?.final_score, riskProfile);
  return fromBackend || data?.signal;
}

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

function mean(values, fallback = 0) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return fallback;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function lastFinite(values, fallback = null) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return fallback;
}

function roundPrice(value) {
  return Number(value.toFixed(2));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parsePositiveNumber(value) {
  const n = toNumber(value);
  return n != null && n >= 0 ? n : null;
}

function money(v) {
  return `${(v || 0).toFixed(2)} TL`;
}

function signedPct(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function signedMoney(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} TL`;
}

function monthKeyFromDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function yearKeyFromDate(date = new Date()) {
  return String(date.getFullYear());
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("tr-TR", { month: "short" });
}

function yearLabel(yearKey) {
  return `${yearKey}`;
}

function shortTrDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function dateKeyFromDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function avgAbs(values, fallback = 0) {
  const valid = values.filter((v) => Number.isFinite(v)).map((v) => Math.abs(v));
  if (!valid.length) return fallback;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function normalizeSigned(value, scale = 1) {
  return clip((value || 0) / Math.max(scale, 1e-6), -1, 1);
}

function normalizePositive(value, scale = 1) {
  return clip((value || 0) / Math.max(scale, 1e-6), 0, 1);
}

function compareDirection(predictedPct, actualPct) {
  const eps = 0.35;
  const expected = predictedPct > eps ? 1 : predictedPct < -eps ? -1 : 0;
  const actual = actualPct > eps ? 1 : actualPct < -eps ? -1 : 0;
  return expected === actual;
}

function sectorBiasScore(sectorName = "") {
  const s = String(sectorName).toLowerCase();
  if (!s) return 0;
  if (s.includes("bank")) return 0.10;
  if (s.includes("energy")) return 0.04;
  if (s.includes("industrial")) return 0.06;
  if (s.includes("consumer")) return 0.08;
  if (s.includes("technology")) return 0.12;
  if (s.includes("health")) return 0.08;
  if (s.includes("communication")) return 0.05;
  if (s.includes("basic materials")) return 0.02;
  if (s.includes("real estate")) return -0.02;
  return 0;
}

const LEARNING_FACTOR_KEYS = [
  "rsi", "macd", "ma", "boll", "stockNews", "marketNews",
  "sector", "competition", "management", "macro", "dividend", "filings", "flow",
];

const LEARNING_WEIGHT_KEY_MAP = {
  rsi: "wRsi",
  macd: "wMacd",
  ma: "wMa",
  boll: "wBoll",
  stockNews: "wStockNews",
  marketNews: "wMarketNews",
  sector: "wSector",
  competition: "wCompetition",
  management: "wManagement",
  macro: "wMacro",
  dividend: "wDividend",
  filings: "wFilings",
  flow: "wFlow",
};

const PREDICTION_HORIZON_DAYS = 5;
const MODEL_VERSION = "v2-multifactor";

function computeAdvancedFactorScores({
  stock,
  closes = [],
  volumes = [],
  company = {},
  market = {},
  stockNewsSentiment = 0,
  marketNewsSentiment = 0,
}) {
  const price = closes[closes.length - 1] || 0;
  const price5d = closes.length > 5 ? ((price - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : 0;
  const price20d = closes.length > 20 ? ((price - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : 0;
  const validVolumes = volumes.filter((v) => Number.isFinite(v));
  const latestVolume = validVolumes[validVolumes.length - 1] || 0;
  const volumeAvg20 = mean(validVolumes.slice(-20), latestVolume || 1);
  const volumeRatio = volumeAvg20 > 0 ? latestVolume / volumeAvg20 : 1;

  const xu100Change20d = market?.xu100?.change20d || 0;
  const usdTryChange20d = market?.usdTry?.change20d || 0;
  const sectorName = company?.sector || stock?.sector || "";
  const industryName = company?.industry || stock?.sector || "";

  const dividendYield = company?.dividendYield || 0;
  const payoutRatio = company?.payoutRatio || 0;
  const profitMargins = company?.profitMargins || 0;
  const operatingMargins = company?.operatingMargins || 0;
  const earningsGrowth = company?.earningsGrowth || 0;
  const revenueGrowth = company?.revenueGrowth || 0;
  const returnOnEquity = company?.returnOnEquity || 0;
  const debtToEquity = company?.debtToEquity || 0;
  const recommendationMean = company?.recommendationMean ?? 3;
  const targetMeanPrice = company?.targetMeanPrice || price;
  const targetUpsidePct = price > 0 && targetMeanPrice
    ? ((targetMeanPrice - price) / price) * 100
    : 0;
  const earningsDate = company?.earningsTimestamp ? new Date(company.earningsTimestamp * 1000) : null;
  const daysToEarnings = earningsDate ? Math.round((earningsDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const payoutBalance = payoutRatio > 0 ? 1 - Math.abs(Math.min(payoutRatio, 1.4) - 0.5) / 0.5 : 0;

  const factorScores = {
    sector: clip(
      sectorBiasScore(sectorName) +
      normalizeSigned(price20d - xu100Change20d, 15) * 0.55 +
      normalizeSigned(revenueGrowth, 0.25) * 0.20 +
      normalizeSigned(stockNewsSentiment, 0.6) * 0.10,
      -1, 1
    ),
    competition: clip(
      normalizeSigned(profitMargins, 0.25) * 0.35 +
      normalizeSigned(operatingMargins, 0.25) * 0.25 +
      normalizeSigned(returnOnEquity, 0.40) * 0.20 -
      normalizeSigned(debtToEquity, 250) * 0.10 +
      normalizeSigned(targetUpsidePct, 20) * 0.10,
      -1, 1
    ),
    management: clip(
      normalizeSigned(earningsGrowth, 0.25) * 0.30 +
      normalizeSigned(revenueGrowth, 0.25) * 0.25 +
      normalizeSigned(returnOnEquity, 0.35) * 0.20 -
      normalizeSigned(debtToEquity, 250) * 0.10 +
      normalizeSigned(3 - recommendationMean, 1.5) * 0.15,
      -1, 1
    ),
    macro: clip(
      normalizeSigned(xu100Change20d, 12) * 0.40 -
      normalizeSigned(usdTryChange20d, 10) * 0.40 +
      normalizeSigned(marketNewsSentiment, 0.5) * 0.20,
      -1, 1
    ),
    dividend: clip(
      normalizePositive(dividendYield, 0.08) * 0.55 +
      clip(payoutBalance, 0, 1) * 0.30 +
      normalizeSigned(profitMargins, 0.20) * 0.15,
      -1, 1
    ),
    filings: clip(
      normalizeSigned(stockNewsSentiment, 0.60) * 0.45 +
      normalizeSigned(targetUpsidePct, 20) * 0.20 +
      normalizeSigned(3 - recommendationMean, 1.5) * 0.20 +
      (daysToEarnings != null && daysToEarnings >= 0 && daysToEarnings <= 14 ? 0.15 : 0),
      -1, 1
    ),
    flow: clip(
      normalizeSigned(volumeRatio - 1, 1.5) * 0.45 +
      normalizeSigned(price5d, 8) * 0.25 +
      normalizeSigned(price20d, 15) * 0.15 +
      normalizeSigned(marketNewsSentiment, 0.5) * 0.15,
      -1, 1
    ),
  };

  const details = [
    {
      key: "sector",
      label: "Sektör Analizi",
      value: factorScores.sector,
      sub: `${sectorName || "BIST"} / ${industryName || "Genel"} sektör proxy skoru · 20g relatif getiri ${(price20d - xu100Change20d).toFixed(2)}%`,
    },
    {
      key: "competition",
      label: "Rekabet Pozisyonu",
      value: factorScores.competition,
      sub: `Marj ve hedef potansiyeli proxy · net kâr marjı ${(profitMargins * 100).toFixed(1)}%`,
    },
    {
      key: "management",
      label: "Yönetim Kalitesi",
      value: factorScores.management,
      sub: `Büyüme + ROE + borç dengesi proxy · ROE ${(returnOnEquity * 100).toFixed(1)}%`,
    },
    {
      key: "macro",
      label: "Makro Faktörler",
      value: factorScores.macro,
      sub: `XU100 20g ${signedPct(xu100Change20d)} · USD/TRY 20g ${signedPct(usdTryChange20d)}`,
    },
    {
      key: "dividend",
      label: "Temettü Politikası",
      value: factorScores.dividend,
      sub: `Temettü verimi ${(dividendYield * 100).toFixed(2)}% · payout ${(payoutRatio * 100).toFixed(1)}%`,
    },
    {
      key: "filings",
      label: "KAP / Kurumsal Olay",
      value: factorScores.filings,
      sub: daysToEarnings != null
        ? `Yaklaşan bilanço/kurumsal olay etkisi proxy · ${daysToEarnings} gün`
        : "Kurumsal olaylar haber ve hedef verilerinden proxy olarak izleniyor",
    },
    {
      key: "flow",
      label: "Piyasa Akışı",
      value: factorScores.flow,
      sub: `Hacim oranı ${volumeRatio.toFixed(2)}x · 5g momentum ${signedPct(price5d)}`,
    },
  ];

  return {
    scores: factorScores,
    details,
    metrics: {
      sectorName,
      industryName,
      price5d,
      price20d,
      volumeRatio,
      xu100Change20d,
      usdTryChange20d,
      dividendYield,
      payoutRatio,
      targetUpsidePct,
      daysToEarnings,
    },
  };
}

function derivePredictionLearningWeights(records = []) {
  const completed = records.filter((row) =>
    row?.actualPrice != null &&
    row?.basePrice != null &&
    row?.factorSnapshot
  );
  if (completed.length < 6) return {};

  const pairsByKey = Object.fromEntries(LEARNING_FACTOR_KEYS.map((key) => [key, []]));
  completed.forEach((row) => {
    const realizedRet = row.basePrice > 0 ? (row.actualPrice - row.basePrice) / row.basePrice : 0;
    LEARNING_FACTOR_KEYS.forEach((key) => {
      const factorValue = row.factorSnapshot?.[key];
      if (Number.isFinite(factorValue)) pairsByKey[key].push([factorValue, realizedRet]);
    });
  });

  function edgeScore(pairs) {
    const pos = pairs.filter((p) => p[0] > 0.15).map((p) => p[1]);
    const neg = pairs.filter((p) => p[0] < -0.15).map((p) => p[1]);
    if (!pos.length || !neg.length) return 1;
    const posAvg = pos.reduce((sum, value) => sum + value, 0) / pos.length;
    const negAvg = neg.reduce((sum, value) => sum + value, 0) / neg.length;
    return Math.max(posAvg - negAvg, 0.0001);
  }

  const rawScores = Object.fromEntries(
    LEARNING_FACTOR_KEYS.map((key) => [key, edgeScore(pairsByKey[key])])
  );
  const avgScore = mean(Object.values(rawScores), 1);

  return Object.fromEntries(
    Object.entries(rawScores).map(([key, value]) => [key, clip(value / avgScore, 0.70, 1.45)])
  );
}

function buildWeightModel(dynamicWeights, factorScores = {}, learnedWeights = {}) {
  const weights = {
    ...dynamicWeights,
    wSector: 0.06 + Math.abs(factorScores.sector || 0) * 0.04,
    wCompetition: 0.06 + Math.abs(factorScores.competition || 0) * 0.04,
    wManagement: 0.06 + Math.abs(factorScores.management || 0) * 0.04,
    wMacro: 0.06 + Math.abs(factorScores.macro || 0) * 0.04,
    wDividend: 0.05 + Math.abs(factorScores.dividend || 0) * 0.03,
    wFilings: 0.05 + Math.abs(factorScores.filings || 0) * 0.03,
    wFlow: 0.06 + Math.abs(factorScores.flow || 0) * 0.04,
  };

  Object.entries(LEARNING_WEIGHT_KEY_MAP).forEach(([factorKey, weightKey]) => {
    if (learnedWeights[factorKey] != null && weights[weightKey] != null) {
      weights[weightKey] *= learnedWeights[factorKey];
    }
  });

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total])
  );
}

function buildForecast({ price, score, closes = [], factorScores = {}, suggestedTargets = {} }) {
  const returns = closes.slice(-25).map((close, idx, arr) => (
    idx === 0 || !arr[idx - 1] ? null : (close - arr[idx - 1]) / arr[idx - 1]
  )).filter((v) => Number.isFinite(v));
  const baseVolatility = clip(avgAbs(returns, 0.012), 0.008, 0.06);
  const factorBias = mean(Object.values(factorScores), 0);
  const expectedPct = clip(
    ((score / 100) * 0.65 + factorBias * 0.35) * Math.max(baseVolatility * Math.sqrt(PREDICTION_HORIZON_DAYS) * 1.9, 0.015),
    -0.18,
    0.18
  );

  let predictedPrice = roundPrice(price * (1 + expectedPct));
  if (expectedPct > 0 && suggestedTargets.sell) {
    predictedPrice = roundPrice(mean([predictedPrice, suggestedTargets.sell], predictedPrice));
  } else if (expectedPct < 0 && suggestedTargets.buy) {
    predictedPrice = roundPrice(mean([predictedPrice, suggestedTargets.buy], predictedPrice));
  }

  const rangePct = Math.max(baseVolatility * Math.sqrt(PREDICTION_HORIZON_DAYS) * 1.2, 0.012);
  return {
    horizonDays: PREDICTION_HORIZON_DAYS,
    expectedPct: Number((expectedPct * 100).toFixed(2)),
    predictedPrice,
    low: roundPrice(predictedPrice * (1 - rangePct)),
    high: roundPrice(predictedPrice * (1 + rangePct)),
    direction: expectedPct > 0.01 ? "YUKARI" : expectedPct < -0.01 ? "AŞAĞI" : "YATAY",
    confidence: clip(Math.abs(score) / 100 * 0.55 + Math.abs(factorBias) * 0.45, 0, 1),
  };
}

function reconcilePredictionRecords(records = [], packaged, symbol) {
  if (!packaged?.closes?.length || !packaged?.dates?.length || !packaged?.forecast) return records;

  const rows = records.map((row) => ({ ...row }));
  const dateRows = packaged.dates.map((d) => new Date(d));

  rows.forEach((row) => {
    if (row.actualPrice != null) return;
    const targetDate = new Date(row.targetDate);
    const idx = dateRows.findIndex((d) => d >= targetDate);
    if (idx < 0) return;
    const actualPrice = packaged.closes[idx];
    const actualPct = row.basePrice > 0 ? ((actualPrice - row.basePrice) / row.basePrice) * 100 : 0;
    row.actualPrice = Number(actualPrice.toFixed(2));
    row.actualDate = dateRows[idx].toISOString();
    row.realizedPct = Number(actualPct.toFixed(2));
    row.errorPct = row.predictedPrice > 0
      ? Number((Math.abs(actualPrice - row.predictedPrice) / row.predictedPrice * 100).toFixed(2))
      : null;
    row.directionHit = compareDirection(row.expectedPct, actualPct);
  });

  const baseDate = packaged.dates[packaged.dates.length - 1];
  const baseDateKey = dateKeyFromDate(baseDate);
  const exists = rows.some((row) => row.baseDateKey === baseDateKey && row.horizonDays === PREDICTION_HORIZON_DAYS);
  if (!exists) {
    rows.push({
      id: `${symbol}-${baseDateKey}-${PREDICTION_HORIZON_DAYS}`,
      symbol,
      modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(),
      baseDate: new Date(baseDate).toISOString(),
      baseDateKey,
      targetDate: addDays(baseDate, PREDICTION_HORIZON_DAYS).toISOString(),
      horizonDays: PREDICTION_HORIZON_DAYS,
      basePrice: Number(packaged.price.toFixed(2)),
      predictedPrice: packaged.forecast.predictedPrice,
      expectedPct: packaged.forecast.expectedPct,
      predictedDirection: packaged.forecast.direction,
      confidence: Number((packaged.forecast.confidence * 100).toFixed(1)),
      score: packaged.score,
      factorSnapshot: { ...packaged.latestSignals, ...packaged.factorScores },
      factorSummary: packaged.factorDetails.map((detail) => ({ key: detail.key, value: detail.value })),
      actualPrice: null,
      actualDate: null,
      realizedPct: null,
      errorPct: null,
      directionHit: null,
    });
  }

  return rows
    .sort((a, b) => new Date(b.baseDate) - new Date(a.baseDate))
    .slice(0, 260);
}

function buildAutoTargets({ closes, price, sma20, sma50, rsi, macd, bollinger, signal, stockNewsSentiment = 0, marketNewsSentiment = 0 }) {
  const last = closes.length - 1;
  const recentCloses = closes.slice(Math.max(0, last - 19), last + 1);
  const recentLow = recentCloses.length ? Math.min(...recentCloses) : price;
  const recentHigh = recentCloses.length ? Math.max(...recentCloses) : price;
  const lowerBand = lastFinite(bollinger.lower, price * 0.94);
  const upperBand = lastFinite(bollinger.upper, price * 1.06);
  const ma20Last = lastFinite(sma20, price);
  const ma50Last = lastFinite(sma50, price);
  const supportBase = mean([lowerBand, Math.min(ma20Last, price), Math.min(ma50Last, price), recentLow], price * 0.96);
  const resistanceBase = mean([upperBand, Math.max(ma20Last, price), Math.max(ma50Last, price), recentHigh], price * 1.04);

  const bandWidth = Math.max(upperBand - lowerBand, price * 0.04);
  const volatilityPct = clip(bandWidth / Math.max(price, 0.01), 0.04, 0.22);
  const histNow = macd.hist[last] ?? 0;
  const histPrev = last > 0 && macd.hist[last - 1] != null ? macd.hist[last - 1] : histNow;
  const macdScale = Math.max(
    ...macd.hist.slice(Math.max(0, last - 30), last + 1).filter((v) => v != null).map((v) => Math.abs(v)),
    1e-6
  );
  const macdBias = clip(histNow / macdScale, -1, 1);
  const macdTurn = clip((histNow - histPrev) / macdScale, -1, 1);
  const stockBias = clip(stockNewsSentiment || 0, -1, 1);
  const marketBias = clip(marketNewsSentiment || 0, -1, 1);
  const newsBias = clip(stockBias * 0.65 + marketBias * 0.35, -1, 1);
  const rsiBuyBias = rsi != null ? clip((35 - rsi) / 20, -0.35, 0.45) : 0;
  const rsiSellBias = rsi != null ? clip((rsi - 65) / 20, -0.35, 0.45) : 0;
  const signalBias = signal === "AL" ? 0.18 : signal === "SAT" ? -0.18 : 0;

  let buy = supportBase + price * volatilityPct * (rsiBuyBias * 0.45 + Math.max(macdBias, 0) * 0.15 + Math.max(macdTurn, 0) * 0.15 + Math.max(newsBias, 0) * 0.15 + signalBias * 0.25);
  let sell = resistanceBase - price * volatilityPct * (rsiSellBias * 0.45 + Math.max(-macdBias, 0) * 0.15 + Math.max(-macdTurn, 0) * 0.15 + Math.max(-newsBias, 0) * 0.15 - signalBias * 0.25);

  buy = clip(buy, price * (1 - volatilityPct * 1.35), price * 0.995);
  sell = clip(sell, price * 1.005, price * (1 + volatilityPct * 1.35));

  let waitLower = Math.max(buy * 1.01, mean([supportBase, ma20Last, price], price) * 0.998);
  let waitUpper = Math.min(sell * 0.99, mean([resistanceBase, ma20Last, price], price) * 1.002);

  if (waitLower >= waitUpper) {
    const center = clip(price, buy * 1.02, sell * 0.98);
    const pad = Math.max(price * 0.01, bandWidth * 0.12);
    waitLower = center - pad;
    waitUpper = center + pad;
  }

  waitLower = clip(waitLower, buy * 1.01, sell * 0.97);
  waitUpper = clip(waitUpper, waitLower * 1.01, sell * 0.99);

  return {
    buy: roundPrice(buy),
    waitLower: roundPrice(waitLower),
    waitUpper: roundPrice(waitUpper),
    sell: roundPrice(sell),
  };
}

function indicatorSignals(i, closes, sma20, sma50, rsi, macd, bollinger, context = {}) {
  const {
    stockNewsSentiment = 0,
    marketNewsSentiment = 0,
    factorScores = {},
  } = context;
  let sRsi = 0, sMacd = 0, sMa = 0, sBoll = 0, sStockNews = 0, sMarketNews = 0;
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
  sStockNews = clip(stockNewsSentiment || 0, -1, 1);
  sMarketNews = clip(marketNewsSentiment || 0, -1, 1);
  return {
    sRsi, sMacd, sMa, sBoll, sStockNews, sMarketNews,
    sSector: clip(factorScores.sector || 0, -1, 1),
    sCompetition: clip(factorScores.competition || 0, -1, 1),
    sManagement: clip(factorScores.management || 0, -1, 1),
    sMacro: clip(factorScores.macro || 0, -1, 1),
    sDividend: clip(factorScores.dividend || 0, -1, 1),
    sFilings: clip(factorScores.filings || 0, -1, 1),
    sFlow: clip(factorScores.flow || 0, -1, 1),
  };
}

function learnWeights(closes, sma20, sma50, rsi, macd, bollinger, warmup, context = {}) {
  const edges = { rsi: [], macd: [], ma: [], boll: [], stockNews: [], marketNews: [] };
  for (let i = warmup; i < closes.length - 1; i++) {
    const { sRsi, sMacd, sMa, sBoll, sStockNews, sMarketNews } = indicatorSignals(
      i, closes, sma20, sma50, rsi, macd, bollinger, context
    );
    const nextRet = (closes[i + 1] - closes[i]) / closes[i];
    edges.rsi.push([sRsi, nextRet]);
    edges.macd.push([sMacd, nextRet]);
    edges.ma.push([sMa, nextRet]);
    edges.boll.push([sBoll, nextRet]);
    edges.stockNews.push([sStockNews, nextRet]);
    edges.marketNews.push([sMarketNews, nextRet]);
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
        eSN = edgeScore(edges.stockNews), eMN = edgeScore(edges.marketNews);
  const total = eR + eM + eA + eB + eSN + eMN || 1;
  return {
    wRsi: eR / total, wMacd: eM / total, wMa: eA / total, wBoll: eB / total,
    wStockNews: eSN / total, wMarketNews: eMN / total,
  };
}

function scoreSeries(closes, sma20, sma50, rsi, macd, bollinger, weights, context = {}) {
  return closes.map((_, i) => {
    const {
      sRsi, sMacd, sMa, sBoll, sStockNews, sMarketNews,
      sSector, sCompetition, sManagement, sMacro, sDividend, sFilings, sFlow,
    } = indicatorSignals(
      i, closes, sma20, sma50, rsi, macd, bollinger, context
    );
    const raw = weights.wRsi * sRsi + weights.wMacd * sMacd + weights.wMa * sMa +
                weights.wBoll * sBoll + weights.wStockNews * sStockNews + weights.wMarketNews * sMarketNews +
                weights.wSector * sSector + weights.wCompetition * sCompetition + weights.wManagement * sManagement +
                weights.wMacro * sMacro + weights.wDividend * sDividend + weights.wFilings * sFilings + weights.wFlow * sFlow;
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
  const volumesRaw = result.indicators?.quote?.[0]?.volume || [];
  const rows = ts.map((t, i) => ({ t, c: closesRaw[i], v: volumesRaw[i] })).filter((r) => r.c != null);
  if (rows.length < 60) throw new Error("yetersiz veri");
  return {
    closes: rows.map((r) => r.c),
    volumes: rows.map((r) => r.v ?? null),
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
    if (!r.ok) return { items: [], avgSentiment: 0, market: { items: [], avgSentiment: 0 }, combinedSentiment: 0 };
    return await r.json();
  } catch { return { items: [], avgSentiment: 0, market: { items: [], avgSentiment: 0 }, combinedSentiment: 0 }; }
}

async function fetchCompany(yahooSymbol) {
  try {
    const r = await fetch(`/api/company?symbol=${encodeURIComponent(yahooSymbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchMarketContext() {
  try {
    const r = await fetch("/api/market");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ── Backend pipeline signal (opsiyonel — yoksa null döner) ── */
async function fetchSignal(symbol) {
  try {
    const r = await fetch(`/api/signal?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ── Sepet performansı: Strateji vs Al-ve-Tut (opsiyonel — yoksa null döner) ── */
async function fetchPerformance(symbols, range, profile = "dengeli") {
  if (!symbols?.length) return null;
  try {
    const r = await fetch(`/api/performance?symbols=${encodeURIComponent(symbols.join(","))}&range=${range}&profile=${profile}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchPipelineStatus() {
  try {
    const r = await fetch("/api/system-status");
    if (!r.ok) return null;
    const j = await r.json();
    // pipeline_runs tablosundan son çalışma bilgisi
    const lastRun = (j.jobs || []).find((job) => job.job_name === "daily-pipeline" || job.status === "success");
    if (!lastRun?.finished_at) return null;
    const hours = (Date.now() - new Date(lastRun.finished_at).getTime()) / 3600000;
    return { hoursSinceLastRun: Math.round(hours), lastRun };
  } catch {
    return null;
  }
}

function generateDemoHistory(basePrice, days = 260) {
  const closes = [], dates = [], volumes = [];
  let price = basePrice;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    price = Math.max(price * (1 + 0.0002 + (Math.random() - 0.5) * 0.028), 0.5);
    closes.push(Number(price.toFixed(2)));
    volumes.push(Math.round(800000 + Math.random() * 2400000));
    const d = new Date(now); d.setDate(d.getDate() - i); dates.push(d);
  }
  return { closes, volumes, dates, currency: "TRY", prevClose: closes[closes.length - 2] };
}

/* ────────────────────────────────────────────────────────────────
   packageHistory — tüm indikatörleri hesapla
   ────────────────────────────────────────────────────────────── */
function packageHistory(hist, context = {}) {
  const {
    stock = null,
    company = null,
    market = null,
    stockNewsSentiment = 0,
    marketNewsSentiment = 0,
    learningRecords = [],
  } = context;
  const { closes, dates, volumes = [] } = hist;
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const rsi = rsiSeries(closes, 14);
  const macd = macdSeries(closes);
  const bollinger = bollingerSeries(closes, 20, 2);
  const warmup = 50;
  const advancedFactors = computeAdvancedFactorScores({
    stock,
    closes,
    volumes,
    company,
    market,
    stockNewsSentiment,
    marketNewsSentiment,
  });
  const learningWeights = derivePredictionLearningWeights(learningRecords);
  const technicalWeights = learnWeights(closes, sma20, sma50, rsi, macd, bollinger, warmup, {
    stockNewsSentiment,
    marketNewsSentiment,
    factorScores: advancedFactors.scores,
  });
  const weights = buildWeightModel(technicalWeights, advancedFactors.scores, learningWeights);
  const scores = scoreSeries(closes, sma20, sma50, rsi, macd, bollinger, weights, {
    stockNewsSentiment,
    marketNewsSentiment,
    factorScores: advancedFactors.scores,
  });
  const last = closes.length - 1;
  const price = closes[last];
  const prevClose = hist.prevClose ?? closes[last - 1];
  const changePct = ((price - prevClose) / prevClose) * 100;
  const maTrend = sma20[last] > sma50[last] ? "Yükseliş" : sma20[last] < sma50[last] ? "Düşüş" : "Yatay";
  const bollPos = bollinger.upper[last] != null
    ? (closes[last] - bollinger.lower[last]) / (bollinger.upper[last] - bollinger.lower[last])
    : 0.5;
  const bollLabel = bollPos > 0.8 ? "Üst banda yakın" : bollPos < 0.2 ? "Alt banda yakın" : "Orta bant yakın";
  const signal = signalFromScore(scores[last]);
  const combinedNewsSentiment = clip(stockNewsSentiment * 0.7 + marketNewsSentiment * 0.3, -1, 1);
  const suggestedTargets = buildAutoTargets({
    closes, price, sma20, sma50, rsi: rsi[last], macd, bollinger, signal,
    stockNewsSentiment, marketNewsSentiment,
  });
  const latestSignals = indicatorSignals(last, closes, sma20, sma50, rsi, macd, bollinger, {
    stockNewsSentiment,
    marketNewsSentiment,
    factorScores: advancedFactors.scores,
  });
  const factorSnapshot = {
    rsi: latestSignals.sRsi,
    macd: latestSignals.sMacd,
    ma: latestSignals.sMa,
    boll: latestSignals.sBoll,
    stockNews: latestSignals.sStockNews,
    marketNews: latestSignals.sMarketNews,
    ...advancedFactors.scores,
  };
  const forecast = buildForecast({
    price,
    score: scores[last],
    closes,
    factorScores: advancedFactors.scores,
    suggestedTargets,
  });
  return {
    closes, volumes, dates, sma20, sma50, rsi: rsi[last], rsiSeries: rsi,
    macdHist: macd.hist[last], macd,
    bollinger, bollPos, bollLabel,
    score: scores[last], scoreSeries: scores,
    signal,
    price, changePct, maTrend, weights, warmup,
    newsSentiment: combinedNewsSentiment,
    stockNewsSentiment,
    marketNewsSentiment,
    suggestedTargets,
    company,
    market,
    factorScores: advancedFactors.scores,
    factorDetails: advancedFactors.details,
    learningWeights,
    latestSignals: factorSnapshot,
    forecast,
  };
}

/* ────────────────────────────────────────────────────────────────
   Bilgi ikonu — teknik terimleri sade dilde açıklar
   ────────────────────────────────────────────────────────────── */
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(r);
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) hide();
    };
    const onScroll = () => hide();
    document.addEventListener("click", onOutside);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onOutside);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Açıklama"
        className="sm-focus"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 15, height: 15, marginLeft: 4, verticalAlign: -2,
          color: open ? C.amber : C.faint, background: "transparent", border: "none",
          padding: 0, cursor: "pointer", flexShrink: 0,
        }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
      >
        <Info size={11} />
      </button>
      {open && pos && createPortal(
        <div
          role="tooltip"
          className="font-body"
          style={{
            position: "fixed",
            left: Math.max(8, Math.min(pos.left + pos.width / 2 - 110, window.innerWidth - 228)),
            top: Math.max(8, pos.top - 8),
            transform: "translateY(-100%)",
            width: 220, zIndex: 200,
            background: "#1B2130", border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.amber}`,
            borderRadius: 8, padding: "9px 11px", fontSize: 11.5, lineHeight: 1.55, color: C.text,
            boxShadow: "0 12px 32px rgba(0,0,0,.5)", pointerEvents: "none",
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
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

function IndicatorBar({ label, value, sub, barPct, color, extra, info }) {
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-body text-xs flex items-center" style={{ color: C.muted }}>{label}{info && <InfoTip text={info} />}</span>
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

function resolveDisplayedTargets(suggestedTargets = {}, manualTargets = {}) {
  const keys = ["buy", "waitLower", "waitUpper", "sell"];
  return keys.reduce((acc, key) => {
    const manualValue = manualTargets?.[key];
    const suggestedValue = suggestedTargets?.[key];
    acc[key] = manualValue != null && String(manualValue).trim() !== ""
      ? manualValue
      : (suggestedValue != null ? suggestedValue.toFixed(2) : "");
    return acc;
  }, {});
}

/* ────────────────────────────────────────────────────────────────
   Hedef fiyat bileşeni (düzenlenebilir)
   ────────────────────────────────────────────────────────────── */
function PriceTarget({ label, color, bg, value, suggestedValue, isManual, onChange, onReset, currentPrice, hitMode }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);

  const handleEdit = () => { setDraft(value || ""); setEditing(true); };
  const handleSave = () => {
    if (String(draft).trim() === "") {
      onReset?.();
      setEditing(false);
      return;
    }
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onChange(n.toFixed(2));
    setEditing(false);
  };

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value || ""); }, [value, editing]);

  const hit = value && currentPrice
    ? (hitMode === "buy" ? currentPrice >= parseFloat(value)
      : hitMode === "sell" ? currentPrice <= parseFloat(value)
      : false)
    : false;

  return (
    <div className="rounded-lg p-3 mb-2" style={{ background: bg, border: `1px solid ${color}33` }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold" style={{ color }}>{label}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: color + "22", color }}>
            {isManual ? "MANUEL" : "OTOMATİK"}
          </span>
          {hit && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: color + "33", color }}>⚡ HEDEF</span>}
        </div>
        {isManual && !editing && (
          <button onClick={onReset} className="sm-focus p-1 rounded hover:opacity-80" style={{ color: C.faint }}>
            <X size={12} />
          </button>
        )}
      </div>
      {!editing && suggestedValue && (
        <div className="font-body text-[10px] mb-2" style={{ color: C.faint }}>
          Otomatik öneri: {suggestedValue} TL
        </div>
      )}
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
  if (!news || (!news.items?.length && !news.market?.items?.length)) return (
    <div className="font-body text-xs py-3" style={{ color: C.faint }}>
      Bu hisse ve piyasa için güncel haber bulunamadı.
    </div>
  );

  const sent = news.avgSentiment;
  const sentColor = sent > 0.1 ? C.green : sent < -0.1 ? C.red : C.amber;
  const sentLabel = sent > 0.1 ? "Pozitif" : sent < -0.1 ? "Negatif" : "Nötr";
  const marketSent = news.market?.avgSentiment ?? 0;
  const marketColor = marketSent > 0.1 ? C.green : marketSent < -0.1 ? C.red : C.amber;
  const marketLabel = marketSent > 0.1 ? "Pozitif" : marketSent < -0.1 ? "Negatif" : "Nötr";

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
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold"
          style={{ background: sentColor + "22", color: sentColor }}>
          Hisse: {sentLabel} {sent > 0 ? "+" : ""}{sent.toFixed(2)}
        </span>
        <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold"
          style={{ background: marketColor + "22", color: marketColor }}>
          Piyasa: {marketLabel} {marketSent > 0 ? "+" : ""}{marketSent.toFixed(2)}
        </span>
        <span className="font-body text-[11px]" style={{ color: C.faint }}>Hisse ve borsa haber özetleri</span>
      </div>
      <div className="space-y-2 mb-4">
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
      {!!news.market?.items?.length && (
        <div>
          <div className="font-body text-[11px] mb-2" style={{ color: C.faint }}>Genel borsa haberleri</div>
          <div className="space-y-2">
            {news.market.items.map((item, idx) => {
              const sc = item.sentiment;
              const ic = sc > 0.1 ? C.green : sc < -0.1 ? C.red : C.amber;
              return (
                <div key={`market-${idx}`} className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
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
      )}
    </div>
  );
}

function PredictionPerformancePanel({ forecast, predictionRecords = [] }) {
  const completed = useMemo(
    () => predictionRecords.filter((row) => row.actualPrice != null).sort((a, b) => new Date(b.baseDate) - new Date(a.baseDate)),
    [predictionRecords]
  );

  const summary = useMemo(() => {
    const directionHits = completed.filter((row) => row.directionHit).length;
    const directionAccuracy = completed.length ? (directionHits / completed.length) * 100 : null;
    const avgError = completed.length
      ? completed.reduce((sum, row) => sum + (row.errorPct || 0), 0) / completed.length
      : null;
    const priceAccuracy = avgError != null ? clip(100 - avgError, 0, 100) : null;
    const composite = directionAccuracy != null && priceAccuracy != null
      ? (directionAccuracy * 0.55 + priceAccuracy * 0.45)
      : null;

    const monthMap = {};
    const yearMap = {};
    completed.forEach((row) => {
      const actualDate = row.actualDate || row.targetDate || row.baseDate;
      const monthKey = monthKeyFromDate(new Date(actualDate));
      const yearKey = yearKeyFromDate(new Date(actualDate));
      monthMap[monthKey] ||= [];
      yearMap[yearKey] ||= [];
      monthMap[monthKey].push(row);
      yearMap[yearKey].push(row);
    });

    const monthlyRows = Object.keys(monthMap).sort((a, b) => a.localeCompare(b)).slice(-12).map((monthKey) => {
      const rows = monthMap[monthKey];
      const hits = rows.filter((row) => row.directionHit).length;
      const avgMonthError = rows.reduce((sum, row) => sum + (row.errorPct || 0), 0) / rows.length;
      const avgPredicted = rows.reduce((sum, row) => sum + row.predictedPrice, 0) / rows.length;
      const avgActual = rows.reduce((sum, row) => sum + row.actualPrice, 0) / rows.length;
      return {
        monthKey,
        count: rows.length,
        directionAccuracy: (hits / rows.length) * 100,
        priceAccuracy: clip(100 - avgMonthError, 0, 100),
        avgPredicted,
        avgActual,
      };
    });

    const yearlyRows = Object.keys(yearMap).sort((a, b) => a.localeCompare(b)).slice(-5).map((yearKey) => {
      const rows = yearMap[yearKey];
      const hits = rows.filter((row) => row.directionHit).length;
      const avgYearError = rows.reduce((sum, row) => sum + (row.errorPct || 0), 0) / rows.length;
      const accuracy = clip(((hits / rows.length) * 55) + ((100 - avgYearError) * 0.45), 0, 100);
      return { yearKey, accuracy, count: rows.length };
    });

    return {
      directionAccuracy,
      priceAccuracy,
      composite,
      monthlyRows,
      yearlyRows,
    };
  }, [completed]);

  const yearMax = Math.max(1, ...summary.yearlyRows.map((row) => row.accuracy));

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 grid-cols-1 gap-3">
        <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
          <div className="font-body text-xs mb-2 flex items-center" style={{ color: C.muted }}>
            Güncel Tahmin ({forecast?.horizonDays || PREDICTION_HORIZON_DAYS}g)
            <InfoTip text="Sistemin, birkaç iş günü sonra fiyatın nerede olacağına dair tahmini. Bu bir garanti değil, geçmiş verilerden yola çıkan bir olasılık hesabıdır." />
          </div>
          {forecast ? (
            <div className="font-mono text-[11px] space-y-1" style={{ color: C.faint }}>
              <div>Tahmin fiyatı: <span style={{ color: C.text }}>{money(forecast.predictedPrice)}</span></div>
              <div>Bant: <span style={{ color: C.text }}>{money(forecast.low)} – {money(forecast.high)}</span></div>
              <div>Beklenen hareket: <span style={{ color: forecast.expectedPct >= 0 ? C.green : C.red }}>{signedPct(forecast.expectedPct)}</span></div>
              <div>Yön: <span style={{ color: C.text }}>{forecast.direction}</span></div>
              <div>Güven: <span style={{ color: C.text }}>%{(forecast.confidence * 100).toFixed(1)}</span></div>
            </div>
          ) : (
            <p className="font-body text-xs" style={{ color: C.faint }}>Tahmin üretilemedi.</p>
          )}
        </div>
        <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
          <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Tahmin Doğruluğu</div>
          {completed.length ? (
            <div className="font-mono text-[11px] space-y-1" style={{ color: C.faint }}>
              <div>Tamamlanan tahmin: <span style={{ color: C.text }}>{completed.length}</span></div>
              <div className="flex items-center">Yön isabeti<InfoTip text="Sistemin 'yükselir mi düşer mi' tahmininin yüzde kaç oranında doğru çıktığı — tam fiyatı değil, sadece yönü baz alır." />: <span style={{ color: C.text }}>{summary.directionAccuracy.toFixed(1)}%</span></div>
              <div>Fiyat yakınlığı: <span style={{ color: C.text }}>{summary.priceAccuracy.toFixed(1)}%</span></div>
              <div className="flex items-center">Bileşik doğruluk<InfoTip text="Hem doğru yönü tahmin edip etmediğine hem tahmin edilen fiyatın gerçek fiyata ne kadar yakın çıktığına birlikte bakan genel bir başarı puanı." />: <span style={{ color: C.text }}>{summary.composite.toFixed(1)}%</span></div>
            </div>
          ) : (
            <p className="font-body text-xs" style={{ color: C.faint }}>Doğruluk hesabı için henüz yeterli kapanmış tahmin yok.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
        <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Son Tahminler · Tahmin Fiyatı vs Gerçekleşen</div>
        {!completed.length ? (
          <p className="font-body text-xs" style={{ color: C.faint }}>İlk tahminler oluştukça burada tahmin edilen ve gerçekleşen fiyatlar görünecek.</p>
        ) : (
          <div className="space-y-2">
            {completed.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-lg p-2.5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-[11px]" style={{ color: C.text }}>
                    {new Date(row.baseDate).toLocaleDateString("tr-TR")} → {new Date(row.actualDate).toLocaleDateString("tr-TR")}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: (row.directionHit ? C.green : C.red) + "22", color: row.directionHit ? C.green : C.red }}>
                    {row.directionHit ? "Yön tuttu" : "Yön kaçtı"}
                  </span>
                </div>
                <div className="grid sm:grid-cols-4 grid-cols-2 gap-2 mt-2 font-mono text-[11px]" style={{ color: C.faint }}>
                  <div>Tahmin: <span style={{ color: C.text }}>{money(row.predictedPrice)}</span></div>
                  <div>Gerçekleşen: <span style={{ color: C.text }}>{money(row.actualPrice)}</span></div>
                  <div>Beklenen: <span style={{ color: row.expectedPct >= 0 ? C.green : C.red }}>{signedPct(row.expectedPct)}</span></div>
                  <div>Hata: <span style={{ color: C.text }}>%{row.errorPct?.toFixed(2)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
        <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Ay Bazında Detay</div>
        {!summary.monthlyRows.length ? (
          <p className="font-body text-xs" style={{ color: C.faint }}>Aylık tahmin detayı için tamamlanan tahmin bekleniyor.</p>
        ) : (
          <div className="space-y-2">
            {summary.monthlyRows.slice().reverse().map((row) => (
              <div key={row.monthKey} className="grid sm:grid-cols-[52px_1fr_auto_auto] grid-cols-1 gap-2 items-center rounded-lg p-2.5"
                style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <span className="font-mono text-[11px]" style={{ color: C.text }}>{monthLabel(row.monthKey)}</span>
                <div className="font-mono text-[11px]" style={{ color: C.faint }}>
                  Ortalama tahmin {money(row.avgPredicted)} · gerçekleşen {money(row.avgActual)}
                </div>
                <span className="font-mono text-[11px]" style={{ color: C.text }}>
                  Yön %{row.directionAccuracy.toFixed(1)}
                </span>
                <span className="font-mono text-[11px]" style={{ color: C.text }}>
                  Fiyat %{row.priceAccuracy.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
        <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Yıl Bazında Grafik</div>
        {!summary.yearlyRows.length ? (
          <p className="font-body text-xs" style={{ color: C.faint }}>Yıllık doğruluk grafiği için yeterli veri yok.</p>
        ) : (
          <div className="space-y-2">
            {summary.yearlyRows.map((row) => (
              <div key={row.yearKey} className="grid grid-cols-[42px_1fr_auto] items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: C.faint }}>{yearLabel(row.yearKey)}</span>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.bg }}>
                  <div className="h-full rounded-full" style={{ width: `${(row.accuracy / yearMax) * 100}%`, background: row.accuracy >= 60 ? C.green : row.accuracy >= 45 ? C.amber : C.red }} />
                </div>
                <span className="font-mono text-[11px]" style={{ color: C.text }}>
                  %{row.accuracy.toFixed(1)} · {row.count} kayıt
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Detay sayfası
   ────────────────────────────────────────────────────────────── */
function DetailPage({ stock, data, usdTry, news, newsLoading, manualTargets, resolvedTargets, predictionRecords, portfolio, onTargetChange, onTargetReset, onPortfolioChange, onClose, signalData, perf, perfRange, onPerfRangeChange, riskProfile, onRiskProfileChange }) {
  const [btAmount, setBtAmount] = useState(10000);
  const [activeTab, setActiveTab] = useState("indicators");
  const displaySignal = data ? resolveDisplaySignal(data, signalData, riskProfile) : null;

  const bt = useMemo(
    () => data ? backtest(data.closes, data.dates, data.scoreSeries, data.warmup, Math.max(btAmount, 1)) : null,
    [data, btAmount]
  );

  if (!data) return null;

  const tabs = [
    { id: "indicators", label: "İndikatörler" },
    { id: "news", label: "Haberler" },
    { id: "prediction", label: "Tahmin" },
    { id: "portfolio", label: "Portföy" },
    { id: "backtest", label: "Simülasyon" },
    { id: "performance", label: "Performans" },
  ];

  const tgt = resolvedTargets || {};
  const manual = manualTargets || {};
  const manualBuy = manual.buy != null && String(manual.buy).trim() !== "";
  const manualWaitLower = manual.waitLower != null && String(manual.waitLower).trim() !== "";
  const manualWaitUpper = manual.waitUpper != null && String(manual.waitUpper).trim() !== "";
  const manualSell = manual.sell != null && String(manual.sell).trim() !== "";
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
                <SignalBadge signal={displaySignal} size="lg" />
                <InfoTip text="Sistemin şu anki önerisi. AL: fiyatın yükselme ihtimali güçlü görünüyor. SAT: düşme ihtimali güçlü görünüyor. BEKLE: yön belirsiz, işlem yapmadan önce beklemek daha mantıklı." />
              </div>
              <p className="font-body text-xs mt-0.5" style={{ color: C.muted }}>
                {stock.name} · {stock.sector}
              </p>
              {signalData?.final_score != null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {Object.entries(RISK_PROFILES).map(([key, p]) => {
                    const sig = signalForProfile(signalData.final_score, key);
                    const sigColor = sig === "AL" ? C.green : sig === "SAT" ? C.red : C.amber;
                    const active = key === riskProfile;
                    return (
                      <button
                        key={key}
                        onClick={() => onRiskProfileChange(key)}
                        className="sm-focus font-mono text-[10.5px] px-2 py-1 rounded-full flex items-center gap-1.5"
                        style={{
                          background: active ? C.amber + "18" : C.panelAlt,
                          border: `1px solid ${active ? C.amber + "55" : C.border}`,
                          color: active ? C.amber : C.muted,
                        }}
                      >
                        {p.label}
                        <span style={{ color: sigColor, fontWeight: 700 }}>{sig}</span>
                      </button>
                    );
                  })}
                  <InfoTip text="Aynı analiz skoru, farklı risk profillerinde farklı bir öneriye dönüşebilir. Seçili profiliniz vurgulu; diğer chip'lere tıklayarak profilinizi değiştirebilirsiniz." />
                </div>
              )}
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
          <h2 className="font-display text-sm font-semibold mb-3 flex items-center" style={{ color: C.text }}>
            AL / BEKLE / SAT Hedefleri
            <InfoTip text="Sistemin önerdiği fiyat seviyeleri. Örneğin 'Alım hedefi 595 TL' demek: fiyat bu seviyeye yaklaşırsa almak mantıklı olabilir — bir garanti değil, geçmiş fiyat hareketlerine dayanan bir öneridir. OTOMATİK: seviyeyi sistem hesapladı. MANUEL: siz kendiniz girdiniz; boş bırakırsanız sistem tekrar otomatik değere döner." />
          </h2>
          <div className="grid grid-cols-1 gap-0">
            <PriceTarget
              label="AL"
              color={C.green}
              bg="rgba(52,211,153,0.06)"
              value={tgt.buy}
              suggestedValue={data.suggestedTargets?.buy?.toFixed(2)}
              isManual={manualBuy}
              onChange={(v) => onTargetChange(stock.symbol, "buy", v)}
              onReset={() => onTargetReset(stock.symbol, "buy")}
              currentPrice={data.price}
              hitMode="buy"
            />
            <PriceTarget
              label="BEKLE (alt)"
              color={C.amber}
              bg="rgba(245,166,35,0.06)"
              value={tgt.waitLower}
              suggestedValue={data.suggestedTargets?.waitLower?.toFixed(2)}
              isManual={manualWaitLower}
              onChange={(v) => onTargetChange(stock.symbol, "waitLower", v)}
              onReset={() => onTargetReset(stock.symbol, "waitLower")}
              currentPrice={null}
            />
            <PriceTarget
              label="BEKLE (üst)"
              color={C.amber}
              bg="rgba(245,166,35,0.06)"
              value={tgt.waitUpper}
              suggestedValue={data.suggestedTargets?.waitUpper?.toFixed(2)}
              isManual={manualWaitUpper}
              onChange={(v) => onTargetChange(stock.symbol, "waitUpper", v)}
              onReset={() => onTargetReset(stock.symbol, "waitUpper")}
              currentPrice={null}
            />
            <PriceTarget
              label="SAT"
              color={C.red}
              bg="rgba(251,91,77,0.06)"
              value={tgt.sell}
              suggestedValue={data.suggestedTargets?.sell?.toFixed(2)}
              isManual={manualSell}
              onChange={(v) => onTargetChange(stock.symbol, "sell", v)}
              onReset={() => onTargetReset(stock.symbol, "sell")}
              currentPrice={data.price}
              hitMode="sell"
            />
          </div>
          <p className="font-body text-[10px] mt-2" style={{ color: C.faint }}>
            ✏ Fiyata tıklayarak düzenle · Boş kaydedersen otomatik öneriye dönersin
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
                info="Hissenin son günlerde çok hızlı alınıp alınmadığını veya satılıp satılmadığını ölçer. Çok yüksekse (aşırı alım) fiyat geri çekilebilir; çok düşükse (aşırı satım) toparlanma ihtimali artar."
                value={data.rsi != null ? data.rsi.toFixed(1) : "—"}
                sub={data.rsi != null ? (data.rsi < 30 ? "Aşırı satım — alım fırsatı olabilir" : data.rsi > 70 ? "Aşırı alım — dikkatli ol" : "Nötr bölge") : ""}
                barPct={data.rsi ?? 50}
                color={data.rsi < 30 ? C.green : data.rsi > 70 ? C.red : C.amber}
              />
              <IndicatorBar
                label="MACD Histogram"
                info="Fiyatın son dönemdeki ivmesini (hızlanıp hızlanmadığını) gösterir. Yukarı yönlüyse yükseliş güçleniyor, aşağı yönlüyse düşüş güçleniyor demektir."
                value={data.macdHist != null ? data.macdHist.toFixed(3) : "—"}
                sub={data.macdHist != null ? (data.macdHist > 0 ? "Momentum yukarı yönlü" : "Momentum aşağı yönlü") : ""}
                barPct={data.macdHist != null ? 50 + clip(data.macdHist * 200, -50, 50) : 50}
                color={data.macdHist > 0 ? C.green : C.red}
              />
              <IndicatorBar
                label="Hareketli Ortalama (20/50)"
                info="Fiyatın son 20 gün ile son 50 günlük ortalamasını karşılaştırır. Kısa vadeli ortalama uzun vadelinin üzerindeyse genel eğilim yukarı, altındaysa aşağı kabul edilir."
                value={data.maTrend}
                sub="Fiyatın kısa ve uzun vadeli ortalamaya göre konumu"
                barPct={data.maTrend === "Yükseliş" ? 80 : data.maTrend === "Düşüş" ? 20 : 50}
                color={data.maTrend === "Yükseliş" ? C.green : data.maTrend === "Düşüş" ? C.red : C.amber}
              />
              <IndicatorBar
                label="Bollinger Bands"
                info="Fiyatın 'normal' aralığının neresinde olduğunu gösterir. Üst sınıra yakınsa fiyat aşırı yükselmiş, alt sınıra yakınsa aşırı düşmüş olabilir."
                value={data.bollLabel}
                sub={`Bant içi konum: %${(data.bollPos * 100).toFixed(0)} — ${data.bollPos > 0.8 ? "aşırı alım yakını" : data.bollPos < 0.2 ? "aşırı satım yakını" : "orta bant"}`}
                barPct={data.bollPos * 100}
                color={data.bollPos > 0.8 ? C.red : data.bollPos < 0.2 ? C.green : C.amber}
              />
              <IndicatorBar
                label="Hisse Haber Sentimenti"
                info="Bu hisseyle ilgili son haberlerin olumlu mu olumsuz mu olduğunu otomatik olarak ölçer. Pozitif değer haber akışının hisse lehine, negatif değer aleyhine olduğunu gösterir."
                value={data.stockNewsSentiment > 0 ? `+${data.stockNewsSentiment.toFixed(2)}` : data.stockNewsSentiment.toFixed(2)}
                sub={data.stockNewsSentiment > 0.1 ? "Hisse haberleri genel olarak olumlu" : data.stockNewsSentiment < -0.1 ? "Hisse haberleri genel olarak olumsuz" : "Hisse haberleri nötr"}
                barPct={50 + data.stockNewsSentiment * 50}
                color={data.stockNewsSentiment > 0.1 ? C.green : data.stockNewsSentiment < -0.1 ? C.red : C.amber}
              />
              <IndicatorBar
                label="Piyasa Haber Sentimenti"
                info="Genel borsa/piyasa haberlerinin olumlu mu olumsuz mu olduğunu ölçer — hisseye özel değil, tüm piyasayı ilgilendiren haber akışıdır."
                value={data.marketNewsSentiment > 0 ? `+${data.marketNewsSentiment.toFixed(2)}` : data.marketNewsSentiment.toFixed(2)}
                sub={data.marketNewsSentiment > 0.1 ? "Borsa haber akışı olumlu" : data.marketNewsSentiment < -0.1 ? "Borsa haber akışı baskılı" : "Borsa haber akışı nötr"}
                barPct={50 + data.marketNewsSentiment * 50}
                color={data.marketNewsSentiment > 0.1 ? C.green : data.marketNewsSentiment < -0.1 ? C.red : C.amber}
              />
              <IndicatorBar
                label="Birleşik Haber Etkisi"
                info="Hem hisseye özel hem genel piyasa haberlerinin birlikte değerlendirilmiş, tek bir sayıya indirgenmiş hali."
                value={data.newsSentiment > 0 ? `+${data.newsSentiment.toFixed(2)}` : data.newsSentiment.toFixed(2)}
                sub={data.newsSentiment > 0.1 ? "Hedefler için haber desteği pozitif" : data.newsSentiment < -0.1 ? "Hedefler için haber baskısı var" : "Hedefler için haber etkisi dengeli"}
                barPct={50 + data.newsSentiment * 50}
                color={data.newsSentiment > 0.1 ? C.green : data.newsSentiment < -0.1 ? C.red : C.amber}
              />
              {data.factorDetails?.map((detail) => (
                <IndicatorBar
                  key={detail.key}
                  label={detail.label}
                  value={detail.value > 0 ? `+${detail.value.toFixed(2)}` : detail.value.toFixed(2)}
                  sub={detail.sub}
                  barPct={50 + detail.value * 50}
                  color={detail.value > 0.15 ? C.green : detail.value < -0.15 ? C.red : C.amber}
                />
              ))}

              {/* Sinyal skoru */}
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-body text-xs flex items-center" style={{ color: C.muted }}>
                    Birleşik Sinyal Skoru
                    <InfoTip text="Yukarıdaki tüm göstergelerin tek bir sayıya indirgenmiş hali. -100 çok güçlü SAT, +100 çok güçlü AL anlamına gelir." />
                  </span>
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
                <p className="font-body text-[11px] mb-2 flex items-center" style={{ color: C.faint }}>
                  Adaptif ağırlıklar (geçmiş veri bazlı öğrenim):
                  <InfoTip text="Sistem her göstergeye ne kadar önem vereceğini, geçmişte hangisinin daha isabetli çıktığına bakarak zamanla kendisi ayarlar. Buradaki yüzdeler o anki önem sırasını gösterir." />
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["RSI", data.weights.wRsi],
                    ["MACD", data.weights.wMacd],
                    ["MA", data.weights.wMa],
                    ["Bollinger", data.weights.wBoll],
                    ["Hisse Haber", data.weights.wStockNews],
                    ["Piyasa Haber", data.weights.wMarketNews],
                    ["Sektör", data.weights.wSector],
                    ["Rekabet", data.weights.wCompetition],
                    ["Yönetim", data.weights.wManagement],
                    ["Makro", data.weights.wMacro],
                    ["Temettü", data.weights.wDividend],
                    ["KAP/Olay", data.weights.wFilings],
                    ["Akış", data.weights.wFlow],
                  ].map(([lbl, w]) => (
                    <span key={lbl} className="font-mono text-[11px] px-2 py-0.5 rounded"
                      style={{ background: C.panelAlt, color: C.muted }}>
                      {lbl} %{Math.round(w * 100)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Backend pipeline model kartları (yalnızca DB verisi varsa) */}
              {signalData?.models?.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <span className="font-display text-sm font-semibold flex items-center mb-3" style={{ color: C.text }}>
                    Bu Sinyali Oluşturan Modeller
                    <InfoTip text="Sinyali üreten üç farklı analiz yöntemi. Ağırlık ne kadar yüksekse, o yöntemin bu karardaki etkisi o kadar fazladır." />
                  </span>

                  <ModelLeaderCards models={signalData.models} regime={signalData.regime} />

                  <div className="font-body text-[10.5px] mt-2.5" style={{ color: C.faint }}>
                    İsabet yüzdeleri bu hissenin son 60 işlem gününde modelin yönlü sinyalleri ile gerçekleşen fiyat
                    hareketinin karşılaştırılmasıyla hesaplanır. Küçük örneklemde (düşük &quot;veri&quot; sayısı) yüzde gürültülü olabilir.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Haberler */}
          {activeTab === "news" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Newspaper size={15} style={{ color: C.amber }} />
                <span className="font-display text-sm font-semibold flex items-center" style={{ color: C.text }}>
                  Güncel Haberler — {stock.symbol}
                  <InfoTip text="Bu puan, haberin hisse için iyi mi kötü mü olduğunu otomatik olarak tahmin eder. +1'e yakın çok olumlu, -1'e yakın çok olumsuz, 0 nötr demektir." />
                </span>
              </div>
              <NewsPanel news={news} loading={newsLoading} />
            </div>
          )}

          {activeTab === "prediction" && (
            <PredictionPerformancePanel
              forecast={data.forecast}
              predictionRecords={predictionRecords || []}
            />
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
                  <label className="font-body text-xs mb-1.5 flex items-center" style={{ color: C.muted }}>
                    Ortalama Maliyet (TL)
                    <InfoTip text="Elinizdeki hisseleri ortalama hangi fiyattan aldığınız. Birden fazla seferde farklı fiyattan aldıysanız, bunların ortalamasıdır." />
                  </label>
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
                <span className="font-display text-sm font-semibold flex items-center" style={{ color: C.text }}>
                  Geriye Dönük Simülasyon
                  <InfoTip text="Bu, gerçek para kullanmadan yapılan bir 'geçmişe dönük deneme'dir: sistem geçmişte önerdiği al/sat kararlarını gerçekten uygulasaydınız ne olurdu, onu gösterir. Geçmişte böyle çıkması, gelecekte de aynı sonucu vereceği anlamına gelmez." />
                </span>
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
                  <div className="font-body text-[11px] flex items-center" style={{ color: C.faint }}>
                    Al-ve-tut kıyası
                    <InfoTip text="Hiçbir şey yapmadan hisseyi elde tutmuş olsaydınız alacağınız sonuçla karşılaştırma." />
                  </div>
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

          {/* Performans */}
          {activeTab === "performance" && (
            <div>
              <p className="font-body text-xs mb-4" style={{ color: C.muted }}>
                Bu sekme, sinyallerin geçmişte gerçekten takip edilseydi ne kazandıracağını — sadece yön isabetini değil,
                gerçekleşen getiriyi ve alınan riski — gösterir. Al-ve-Tut ile karşılaştırma, sistemin kendi başına katma
                değer üretip üretmediğini görmenizi sağlar.
              </p>

              {!perf ? (
                <div className="font-body text-xs py-4 text-center" style={{ color: C.faint }}>Yükleniyor…</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Sepet Performansı</span>
                    <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      {PERF_RANGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => onPerfRangeChange(opt.id)}
                          className="sm-focus font-mono text-[11px] font-semibold px-2.5 py-1 rounded-md"
                          style={{
                            background: perfRange === opt.id ? C.amber + "2e" : "transparent",
                            color: perfRange === opt.id ? C.amber : C.muted,
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        STRATEJİ GETİRİSİ
                        <InfoTip text="Sistemin size verdiği AL/SAT önerilerini baştan sona takip etseydiniz, seçtiğiniz dönemde ne kadar kazanmış olurdunuz." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: perf.kpi.stratPct >= 0 ? C.green : C.red }}>{signedPct(perf.kpi.stratPct)}</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        AL-VE-TUT GETİRİSİ
                        <InfoTip text="Hiçbir şey yapmadan, hisseleri en başta alıp hiç satmadan elde tutsaydınız ne kadar kazanmış olurdunuz." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: C.muted }}>{signedPct(perf.kpi.benchPct)}</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        FARK (ALFA)
                        <InfoTip text="Sistemi takip etmenin, hiçbir şey yapmadan beklemeye göre size kaç puan daha fazla (veya az) kazandırdığı." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: perf.kpi.alphaPct >= 0 ? C.green : C.red }}>{signedPct(perf.kpi.alphaPct)}</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        İSABET ORANI
                        <InfoTip text="Verilen önerilerin yüzde kaçının doğru çıktığı." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: C.text }}>{perf.kpi.hitPct != null ? `%${perf.kpi.hitPct}` : "—"}</div>
                      {perf.kpi.hitPct == null && <div className="font-body text-[10px] mt-0.5" style={{ color: C.faint }}>yetersiz veri (n={perf.kpi.tradeCount})</div>}
                    </div>
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        MAKS. DÜŞÜŞ
                        <InfoTip text="Seçilen dönem içinde, en tepeden en dibe kadar en çok ne kadar değer kaybı yaşandığı. Düşük olması daha güvenli demektir." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: C.red }}>-{perf.kpi.maxDrawdownPct}%</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                      <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                        İŞLEM SAYISI
                        <InfoTip text="Bu dönemde kaç kere al/sat yönü değiştirildiği. Çok sık değişim gerçek hayatta işlem masrafı demektir; sistem gereksiz sık dönüş yapmaması için ayarlanmıştır." />
                      </div>
                      <div className="font-mono text-lg font-bold mt-1" style={{ color: C.amber }}>{perf.kpi.tradeCount}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm font-semibold flex items-center" style={{ color: C.text }}>
                      Kümülatif Getiri
                      <InfoTip text="İki çizgi de sıfırdan başlar. Turuncu çizgi sistemi takip etseydiniz birikecek kazancı, gri kesikli çizgi hiç işlem yapmasaydınız birikecek kazancı gösterir." />
                    </span>
                    <span className="font-body text-[10.5px]" style={{ color: C.faint }}>imleci grafiğe götürün</span>
                  </div>
                  <div className="rounded-lg p-3 mb-5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-4 mb-2 font-body text-[11px]" style={{ color: C.muted }}>
                      <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2.5px solid ${C.amber}` }} />Strateji (sepet)</span>
                      <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2.5px dashed ${C.muted}` }} />Al-ve-Tut</span>
                    </div>
                    <EquityChart labels={perf.labels} strategy={perf.strategy} benchmark={perf.benchmark} height={220} />
                  </div>

                  {signalData?.models?.length > 0 && (
                    <div className="mb-5">
                      <span className="font-display text-sm font-semibold flex items-center mb-3" style={{ color: C.text }}>
                        Şu An Öne Çıkan Model
                        <InfoTip text="Şu anki piyasa koşullarında sisteme en çok hangi analiz yönteminin yön verdiği." />
                      </span>
                      <ModelLeaderCards models={signalData.models} regime={signalData.regime} />
                    </div>
                  )}

                  {!!perf.perStock && Object.keys(perf.perStock).length > 0 && (
                    <div>
                      <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Hisse Bazlı Kırılım</span>
                      <div className="mt-3 space-y-2">
                        {Object.entries(perf.perStock).map(([symbol, s]) => (
                          <div key={symbol} className="flex items-center justify-between rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
                            <span className="font-mono text-xs font-semibold" style={{ color: C.text }}>{symbol}</span>
                            <div className="text-right">
                              <div className="font-mono text-sm font-bold" style={{ color: s.deltaPct >= 0 ? C.green : C.red }}>{signedPct(s.deltaPct)}</div>
                              {s.leadingModel && <div className="font-body text-[10px]" style={{ color: C.faint }}>Lider: {s.leadingModel}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-body text-[10.5px] mt-5 pt-3" style={{ color: C.faint, borderTop: `1px solid ${C.border}` }}>
                    Geçmiş performans gelecekteki sonuçların garantisi değildir. Uygulama yatırım tavsiyesi vermez.
                  </p>
                </>
              )}
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
   Strateji vs Al-ve-Tut — kümülatif getiri grafiği
   ────────────────────────────────────────────────────────────── */
function EquityChart({ labels, strategy, benchmark, height = 200, compact = false }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!labels?.length) {
    return (
      <div className="font-body text-xs py-6 text-center" style={{ color: C.faint }}>
        Grafik için henüz yeterli veri yok. Pipeline birkaç gün çalıştıkça burada dolacak.
      </div>
    );
  }

  const W = 700, H = height, padL = 4, padR = 4, padT = compact ? 8 : 14, padB = compact ? 6 : 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = labels.length;
  const last = n - 1;

  const allVals = strategy.concat(benchmark);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals) * 1.08 || 1;

  const x = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const pathFor = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = `${pathFor(strategy)} L${x(last).toFixed(1)},${y(minV).toFixed(1)} L${x(0).toFixed(1)},${y(minV).toFixed(1)} Z`;
  const gradId = `perfGrad_${compact ? "c" : "f"}`;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    setHoverIdx(clip(Math.round(relX * last), 0, last));
  };

  const hi = hoverIdx != null ? hoverIdx : last;
  const lastStrat = strategy[last];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}>
        {(compact ? [0] : [0, maxV * 0.5, maxV]).map((gv, idx) => (
          <line key={idx} x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke={gv === 0 ? "#2A3140" : "#1B2130"} strokeWidth="1" />
        ))}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.amber} stopOpacity="0.28" />
            <stop offset="100%" stopColor={C.amber} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={pathFor(benchmark)} fill="none" stroke={C.muted} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor(strategy)} fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(last)} cy={y(lastStrat)} r={compact ? 2.5 : 3.5} fill={C.amber} />
        <circle cx={x(last)} cy={y(benchmark[last])} r={compact ? 2.5 : 3.5} fill={C.muted} />
        {!compact && (
          <text x={x(last) - 2} y={y(lastStrat) - 9} textAnchor="end" fill={C.amber} fontSize="11" fontWeight="700"
            fontFamily="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">
            {lastStrat >= 0 ? "+" : ""}{lastStrat.toFixed(1)}%
          </text>
        )}
        {!compact && [0, Math.floor(last / 2), last].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            fill={C.faint} fontSize="10" fontFamily="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">
            {shortTrDate(labels[i])}
          </text>
        ))}
        {hoverIdx != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + plotH} stroke={C.faint} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hi)} cy={y(strategy[hi])} r={(compact ? 2.5 : 3.5) + 1} fill={C.amber} stroke={C.bg} strokeWidth="2" />
            <circle cx={x(hi)} cy={y(benchmark[hi])} r={(compact ? 2.5 : 3.5) + 1} fill={C.muted} stroke={C.bg} strokeWidth="2" />
          </>
        )}
        <rect x="0" y="0" width={W} height={H} fill="transparent" style={{ cursor: "crosshair" }}
          onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />
      </svg>
      {hoverIdx != null && (
        <div className="font-mono absolute" style={{
          left: `${(x(hi) / W) * 100}%`, top: `${(y(Math.max(strategy[hi], benchmark[hi])) / H) * 100}%`,
          transform: "translate(-50%, -115%)", background: "#1B2130", border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "8px 10px", fontSize: 11, whiteSpace: "nowrap",
          boxShadow: "0 8px 20px rgba(0,0,0,.35)", zIndex: 5, pointerEvents: "none",
        }}>
          <div style={{ color: C.faint, marginBottom: 4 }}>{shortTrDate(labels[hi])}</div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber }} />
            Strateji {strategy[hi] >= 0 ? "+" : ""}{strategy[hi].toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.muted }} />
            Al-ve-Tut {benchmark[hi] >= 0 ? "+" : ""}{benchmark[hi].toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Model liderlik kartları — İndikatörler ve Performans sekmelerinde ortak
   ────────────────────────────────────────────────────────────── */
function ModelLeaderCards({ models, regime }) {
  if (!models?.length) return null;
  const sorted = [...models].sort((a, b) => b.weightPct - a.weightPct);
  return (
    <>
      {regime && REGIME_LABELS[regime] && (
        <div className="mb-3 flex items-center justify-end">
          <span
            className="font-mono text-[10px] px-2 py-1 rounded-md flex items-center"
            style={{
              background: `rgba(${REGIME_LABELS[regime].color === "green" ? "52,211,153" : REGIME_LABELS[regime].color === "red" ? "251,91,77" : "245,166,35"},0.14)`,
              color: REGIME_LABELS[regime].color === "green" ? C.green : REGIME_LABELS[regime].color === "red" ? C.red : C.amber,
            }}
          >
            {REGIME_LABELS[regime].label}
            <InfoTip text="Piyasanın şu anki genel havası. Sistem, piyasanın durumuna göre hangi analiz yöntemine daha çok güveneceğini buna göre ayarlar." />
          </span>
        </div>
      )}
      <div className="space-y-2">
        {sorted.map((m, idx) => (
          <div key={m.key} className="rounded-lg p-3 relative" style={{
            background: C.panelAlt,
            border: `1px solid ${idx === 0 ? C.amber + "55" : C.border}`,
          }}>
            {idx === 0 && (
              <span className="font-mono absolute -top-2 right-2.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full"
                style={{ background: C.amber, color: "#1a1204", letterSpacing: "0.03em" }}>
                ŞU AN LİDER
              </span>
            )}
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-body text-xs font-medium" style={{ color: C.text }}>{m.label}</span>
              <span className="font-mono text-[11px]" style={{ color: C.amber }}>%{m.weightPct} ağırlık</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: C.border }}>
              <div className="h-full rounded-full" style={{ width: `${m.weightPct}%`, background: C.amber }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-[10.5px]" style={{ color: C.faint }}>{m.description}</span>
              <span
                className="font-mono text-[11px] flex-shrink-0 ml-2"
                style={{ color: m.hitRatePct != null ? (m.hitRatePct >= 55 ? C.green : C.muted) : C.faint }}
              >
                {m.hitRatePct != null ? `%${m.hitRatePct} isabet` : `veri birikiyor (${m.sampleSize}/60)`}
                {m.avgReturnPct != null && (
                  <span style={{ color: m.avgReturnPct >= 0 ? C.green : C.red }}>
                    {" · "}{m.avgReturnPct >= 0 ? "+" : ""}{m.avgReturnPct}% ort. getiri
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   Toplam Portföy Performansı — Dashboard kartı (Strateji vs Al-ve-Tut)
   ────────────────────────────────────────────────────────────── */
const PERF_RANGE_OPTIONS = [
  { id: "week", label: "Hafta" },
  { id: "month", label: "Ay" },
  { id: "year", label: "Yıl" },
];

function PortfolioPerformanceCard({ perf, range, onRangeChange, onSelectStock }) {
  const kpi = perf?.kpi;
  const rangeSubLabel = { week: "son 7 gün", month: "son 30 gün", year: "son 12 ay" }[range];

  return (
    <div className="rounded-xl p-4 mb-5" style={{
      background: `linear-gradient(160deg, ${C.amber}1a, ${C.panel} 45%)`,
      border: `1px solid ${C.amber}55`,
    }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="font-display text-sm font-semibold" style={{ color: C.text }}>📊 Toplam Portföy Performansı</div>
          <div className="font-body text-[11px] mt-0.5" style={{ color: C.muted }}>
            {perf?.symbols?.join(" + ") || "Seçili hisseler"} birleşik · {rangeSubLabel}
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
          {PERF_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onRangeChange(opt.id)}
              className="sm-focus font-mono text-[11px] font-semibold px-2.5 py-1 rounded-md"
              style={{
                background: range === opt.id ? C.amber + "2e" : "transparent",
                color: range === opt.id ? C.amber : C.muted,
              }}
            >
              {opt.label}
            </button>
          ))}
          <InfoTip text="Performansı hangi zaman aralığında görmek istediğinizi seçin. Kısa dönemlerde (özellikle Hafta) sonuçlar çok az işleme dayandığı için güvenilirliği düşüktür." />
        </div>
      </div>

      {!perf ? (
        <div className="font-body text-xs py-4 text-center" style={{ color: C.faint }}>
          Portföy performansı yükleniyor…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                STRATEJİ
                <InfoTip text="Sistemin size verdiği AL/SAT önerilerini baştan sona takip etseydiniz, seçtiğiniz dönemde ne kadar kazanmış olurdunuz." />
              </div>
              <div className="font-mono text-base font-bold mt-1" style={{ color: kpi.stratPct >= 0 ? C.green : C.red }}>{signedPct(kpi.stratPct)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                AL-VE-TUT
                <InfoTip text="Hiçbir şey yapmadan, hisseleri en başta alıp hiç satmadan elde tutsaydınız ne kadar kazanmış olurdunuz. Sistemin gerçekten işe yarayıp yaramadığını anlamak için bununla karşılaştırıyoruz." />
              </div>
              <div className="font-mono text-base font-bold mt-1" style={{ color: C.muted }}>{signedPct(kpi.benchPct)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                FARK (ALFA)
                <InfoTip text="Sistemi takip etmenin, hiçbir şey yapmadan beklemeye göre size kaç puan daha fazla (veya az) kazandırdığı. Pozitifse sistem katkı sağlamış demektir." />
              </div>
              <div className="font-mono text-base font-bold mt-1" style={{ color: kpi.alphaPct >= 0 ? C.green : C.red }}>{signedPct(kpi.alphaPct)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="font-body text-[10px] flex items-center" style={{ color: C.muted }}>
                İSABET ORANI
                <InfoTip text="Verilen önerilerin yüzde kaçının doğru çıktığı. Örneğin %61, 100 öneriden yaklaşık 61'inin doğru yönde olduğu anlamına gelir." />
              </div>
              <div className="font-mono text-base font-bold mt-1" style={{ color: C.text }}>
                {kpi.hitPct != null ? `%${kpi.hitPct}` : "—"}
              </div>
              {kpi.hitPct == null && (
                <div className="font-body text-[9.5px] mt-0.5" style={{ color: C.faint }}>yetersiz veri (n={kpi.tradeCount})</div>
              )}
            </div>
          </div>

          <div className="rounded-lg p-3 mb-3" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-4 mb-2 font-body text-[11px]" style={{ color: C.muted }}>
              <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2.5px solid ${C.amber}` }} />Strateji</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2.5px dashed ${C.muted}` }} />Al-ve-Tut</span>
            </div>
            <EquityChart labels={perf.labels} strategy={perf.strategy} benchmark={perf.benchmark} height={110} compact />
          </div>

          {!!perf.perStock && Object.keys(perf.perStock).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(perf.perStock).map(([symbol, s]) => (
                <button
                  key={symbol}
                  onClick={() => onSelectStock?.(symbol)}
                  className="sm-focus font-mono text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
                  style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
                >
                  {symbol}
                  <span style={{ color: s.deltaPct >= 0 ? C.green : C.red, fontWeight: 700 }}>{signedPct(s.deltaPct)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Risk Profili — aynı analiz skorunun ne zaman harekete geçirileceğini
   belirleyen karar katmanı (skor üretimini değil, eşiği/onay penceresini
   etkiler)
   ────────────────────────────────────────────────────────────── */
function RiskProfileCard({ riskProfile, onChange }) {
  const active = RISK_PROFILES[riskProfile] || RISK_PROFILES.dengeli;
  return (
    <div className="rounded-xl p-4 mt-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="font-display text-sm font-semibold mb-3 flex items-center" style={{ color: C.text }}>
        🎚️ Risk Profili
        <InfoTip text="Ne kadar sinyal beklediğinizi ve ne kadar hızlı tepki vermek istediğinizi belirler. Muhafazakar: az ama güçlü sinyalde harekete geçer. Agresif: daha sık, daha erken sinyal üretir ama yanlış alarm riski de artar. Analiz skorunun kendisi değişmez — sadece o skoru ne zaman 'harekete geçilir' saydığınız değişir." />
      </div>
      <div className="grid sm:grid-cols-3 grid-cols-1 gap-2 mb-3">
        {Object.entries(RISK_PROFILES).map(([key, p]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="sm-focus text-left rounded-lg p-2.5"
            style={{
              background: key === riskProfile ? C.amber + "18" : C.panelAlt,
              border: `1px solid ${key === riskProfile ? C.amber + "55" : C.border}`,
            }}
          >
            <div className="font-body text-xs font-bold" style={{ color: key === riskProfile ? C.amber : C.text }}>{p.label}</div>
            <div className="font-body text-[10px] mt-0.5" style={{ color: C.faint }}>{p.desc}</div>
          </button>
        ))}
      </div>
      <div className="font-mono text-[10.5px] pt-2.5" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
        AL/SAT eşiği: <span style={{ color: C.text }}>±{active.buy}</span>
        {"  ·  "}Onay penceresi: <span style={{ color: C.text }}>{active.confirmDays} gün</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Hisse kartı
   ────────────────────────────────────────────────────────────── */
function StockCard({ stock, data, status, error, onRetry, onDemo, onSelect, onRemove, usdTry, manualTargets, resolvedTargets, signalData, riskProfile }) {
  const displaySignal = data ? resolveDisplaySignal(data, signalData, riskProfile) : null;
  const tgt = resolvedTargets || {};
  const manual = manualTargets || {};
  const manualBuy = manual.buy != null && String(manual.buy).trim() !== "";
  const manualSell = manual.sell != null && String(manual.sell).trim() !== "";

  const targetLine = () => {
    if (!data) return null;
    if (displaySignal === "AL" && tgt.buy) {
      return <span className="font-mono text-[11px]" style={{ color: C.green }}>Alım hedefi{manualBuy ? " (manuel)" : ""}: {tgt.buy} TL</span>;
    }
    if (displaySignal === "BEKLE" && tgt.waitLower && tgt.waitUpper) {
      return <span className="font-mono text-[11px]" style={{ color: C.amber }}>Bekle bandı: {tgt.waitLower}–{tgt.waitUpper} TL</span>;
    }
    if (displaySignal === "SAT" && tgt.sell) {
      return <span className="font-mono text-[11px]" style={{ color: C.red }}>Satış hedefi{manualSell ? " (manuel)" : ""}: {tgt.sell} TL</span>;
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
              <SignalBadge signal={displaySignal} />
              {targetLine()}
              {signalData?.models?.[0] && (
                <div className="font-mono text-[10px] mt-0.5 inline-flex items-center gap-1" style={{ color: C.faint }}>
                  <span style={{ color: C.amber }}>{signalData.models[0].short || signalData.models[0].label}</span>
                  {signalData.models[0].hitRatePct != null && <span>· %{signalData.models[0].hitRatePct} isabet</span>}
                  <InfoTip text="Bu sinyali en çok hangi analiz yönteminin belirlediği ve o yöntemin son dönemde yüzde kaç doğru çıktığı." />
                </div>
              )}
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
function PortfolioSummary({ items, portfolio, onSelectStock, signalMap, riskProfile }) {
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
                <SignalBadge signal={resolveDisplaySignal(data, signalMap?.[stock.symbol], riskProfile)} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NetTargetPanel({
  settings,
  onSettingsChange,
  onMonthlyPctChange,
  onMonthlyTlChange,
  onYearlyPctChange,
  onYearlyTlChange,
  summary,
}) {
  const {
    portfolioValue,
    monthlyStartValue,
    yearlyStartValue,
    monthlyTargetPct,
    monthlyTargetTl,
    yearlyTargetPct,
    yearlyTargetTl,
    monthlyNetTl,
    monthlyNetPct,
    yearlyNetTl,
    yearlyNetPct,
    monthlyGrossTl,
    yearlyGrossTl,
    monthlyCost,
    yearlyCostTotal,
    daysLeftInMonth,
    requiredDailyTl,
    chartRows,
  } = summary;

  const monthlyProgress = monthlyTargetTl > 0 ? clip((monthlyNetTl / monthlyTargetTl) * 100, -999, 999) : null;
  const yearlyProgress = yearlyTargetTl > 0 ? clip((yearlyNetTl / yearlyTargetTl) * 100, -999, 999) : null;
  const chartMax = Math.max(
    1,
    ...chartRows.flatMap((r) => [Math.abs(r.netPct || 0), Math.abs(r.targetPct || 0)])
  );

  return (
    <div className="rounded-xl p-4 mt-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Activity size={15} style={{ color: C.amber }} />
        <span className="font-display text-sm font-semibold" style={{ color: C.text }}>Ana Para & Hedef Takibi (Net)</span>
      </div>

      <div className="grid sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
        <div>
          <label className="font-body text-xs mb-1.5 flex items-center" style={{ color: C.muted }}>
            Başlangıç Ana Para (referans TL)
            <InfoTip text="Yatırıma başlarken koyduğunuz referans tutar. Kâr/zarar ve hedef takibi bu rakama göre hesaplanır." />
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.initialPrincipal}
            onChange={(e) => onSettingsChange("initialPrincipal", e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
            placeholder="10000000"
          />
        </div>
        <div>
          <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Portföy Değeri (nakit hariç)</label>
          <div className="font-mono rounded-lg px-3 py-2 text-sm" style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}>
            {money(portfolioValue)}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
        <div>
          <label className="font-body text-xs mb-1.5 flex items-center" style={{ color: C.muted }}>
            Aylık Hedef %
            <InfoTip text="Ulaşmayı hedeflediğiniz aylık kazanç oranı. Panel, mevcut durumunuzun bu hedefe göre ne kadar ilerlediğini gösterir." />
          </label>
          <input type="number" step="0.01" value={settings.monthlyTargetPct} onChange={(e) => onMonthlyPctChange(e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="3.00" />
        </div>
        <div>
          <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Aylık Hedef TL</label>
          <input type="number" step="0.01" value={settings.monthlyTargetTl} onChange={(e) => onMonthlyTlChange(e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="300000" />
        </div>
        <div>
          <label className="font-body text-xs mb-1.5 flex items-center" style={{ color: C.muted }}>
            Yıllık Hedef %
            <InfoTip text="Ulaşmayı hedeflediğiniz yıllık kazanç oranı. Panel, mevcut durumunuzun bu hedefe göre ne kadar ilerlediğini gösterir." />
          </label>
          <input type="number" step="0.01" value={settings.yearlyTargetPct} onChange={(e) => onYearlyPctChange(e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="36.00" />
        </div>
        <div>
          <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Yıllık Hedef TL</label>
          <input type="number" step="0.01" value={settings.yearlyTargetTl} onChange={(e) => onYearlyTlChange(e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="3600000" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
        <div>
          <label className="font-body text-xs mb-1.5 flex items-center" style={{ color: C.muted }}>
            Aylık Net Kesinti (TL)
            <InfoTip text="Vergi, komisyon gibi getirinizden düşülecek kalemler. Hedeflerinize göre eldeki gerçek kazancı daha doğru hesaplamak için kullanılır." />
          </label>
          <input type="number" min={0} step="0.01" value={settings.monthlyCostsTl} onChange={(e) => onSettingsChange("monthlyCostsTl", e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="15000" />
        </div>
        <div>
          <label className="font-body text-xs block mb-1.5" style={{ color: C.muted }}>Yıllık Ek Net Kesinti (TL)</label>
          <input type="number" min={0} step="0.01" value={settings.yearlyExtraCostsTl} onChange={(e) => onSettingsChange("yearlyExtraCostsTl", e.target.value)}
            className="font-mono sm-focus w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }} placeholder="0" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
          <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Güncel Ay (detay)</div>
          <div className="font-mono text-[11px] space-y-1" style={{ color: C.faint }}>
            <div>Dönem başı: <span style={{ color: C.text }}>{monthlyStartValue != null ? money(monthlyStartValue) : "—"}</span></div>
            <div>Hedef: <span style={{ color: C.text }}>{money(monthlyTargetTl)} · {signedPct(monthlyTargetPct)}</span></div>
            <div>Gerçekleşen net: <span style={{ color: monthlyNetTl >= 0 ? C.green : C.red }}>{signedMoney(monthlyNetTl)} · {signedPct(monthlyNetPct)}</span></div>
            <div>Sapma: <span style={{ color: monthlyNetTl - monthlyTargetTl >= 0 ? C.green : C.red }}>{signedMoney(monthlyNetTl - monthlyTargetTl)}</span></div>
            <div className="flex items-center">Hedefe ilerleme<InfoTip text="Bu ay için koyduğunuz hedefin şu ana kadar yüzde kaçına ulaştığınız. %100'e ulaşırsanız aylık hedefinizi tam karşılamışsınız demektir." />: <span style={{ color: C.text }}>{monthlyProgress != null && Number.isFinite(monthlyProgress) ? `${monthlyProgress.toFixed(1)}%` : "—"}</span></div>
            <div>Kesinti etkisi: <span style={{ color: C.text }}>{signedMoney(monthlyGrossTl - monthlyNetTl)} (Aylık kesinti: {money(monthlyCost)})</span></div>
            <div>Kalan gün: <span style={{ color: C.text }}>{daysLeftInMonth}</span> · Gerekli günlük net: <span style={{ color: C.text }}>{requiredDailyTl != null ? money(requiredDailyTl) : "—"}</span></div>
          </div>
        </div>
        <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
          <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Yıl Özeti (net)</div>
          <div className="font-mono text-[11px] space-y-1" style={{ color: C.faint }}>
            <div>Dönem başı: <span style={{ color: C.text }}>{yearlyStartValue != null ? money(yearlyStartValue) : "—"}</span></div>
            <div>Hedef: <span style={{ color: C.text }}>{money(yearlyTargetTl)} · {signedPct(yearlyTargetPct)}</span></div>
            <div>Gerçekleşen net: <span style={{ color: yearlyNetTl >= 0 ? C.green : C.red }}>{signedMoney(yearlyNetTl)} · {signedPct(yearlyNetPct)}</span></div>
            <div>Sapma: <span style={{ color: yearlyNetTl - yearlyTargetTl >= 0 ? C.green : C.red }}>{signedMoney(yearlyNetTl - yearlyTargetTl)}</span></div>
            <div className="flex items-center">Hedefe ilerleme<InfoTip text="Bu yıl için koyduğunuz hedefin şu ana kadar yüzde kaçına ulaştığınız." />: <span style={{ color: C.text }}>{yearlyProgress != null && Number.isFinite(yearlyProgress) ? `${yearlyProgress.toFixed(1)}%` : "—"}</span></div>
            <div>Kesinti etkisi: <span style={{ color: C.text }}>{signedMoney(yearlyGrossTl - yearlyNetTl)} (Yıllık toplam kesinti: {money(yearlyCostTotal)})</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-lg p-3" style={{ background: C.panelAlt }}>
        <div className="font-body text-xs mb-2" style={{ color: C.muted }}>Aylık Net Performans (Hedef vs Gerçekleşen)</div>
        {!chartRows.length ? (
          <p className="font-body text-xs" style={{ color: C.faint }}>Grafik, aylık snapshot oluştukça dolacaktır.</p>
        ) : (
          <div className="grid gap-1.5">
            {chartRows.map((row) => {
              const netPct = row.netPct || 0;
              const tgtPct = row.targetPct || 0;
              const netW = `${(Math.abs(netPct) / chartMax) * 100}%`;
              const tgtW = `${(Math.abs(tgtPct) / chartMax) * 100}%`;
              return (
                <div key={row.monthKey} className="grid grid-cols-[46px_1fr_auto] items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: C.faint }}>{monthLabel(row.monthKey)}</span>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: C.bg }}>
                      <div className="h-full rounded-full" style={{ width: netW, background: netPct >= 0 ? C.green : C.red }} />
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                      <div className="h-full rounded-full" style={{ width: tgtW, background: C.amber }} />
                    </div>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: netPct >= tgtPct ? C.green : C.red }}>
                    {signedPct(netPct)} / Hedef {signedPct(tgtPct)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Ana uygulama
   ────────────────────────────────────────────────────────────── */
export default function SinyalMasasi() {
  const [stocks, setStocks] = useState(DEFAULT_STOCKS);
  const [statusMap, setStatusMap] = useState({});
  const [dataMap, setDataMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [newsMap, setNewsMap] = useState({});
  const [newsLoadingMap, setNewsLoadingMap] = useState({});
  const [companyMap, setCompanyMap] = useState({});
  const [marketContext, setMarketContext] = useState(null);
  const [usdTry, setUsdTry] = useState(null);
  const [detailSymbol, setDetailSymbol] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [netTargetSettings, setNetTargetSettings] = useState({
    initialPrincipal: "",
    monthlyTargetPct: "",
    monthlyTargetTl: "",
    yearlyTargetPct: "",
    yearlyTargetTl: "",
    monthlyCostsTl: "",
    yearlyExtraCostsTl: "",
  });
  const [perfSnapshots, setPerfSnapshots] = useState({ months: {}, years: {} });
  const [monthlyHistory, setMonthlyHistory] = useState({});
  const [predictionLedger, setPredictionLedger] = useState({});
  const [signalMap, setSignalMap] = useState({});          // backend pipeline sinyalleri
  const [pipelineStatus, setPipelineStatus] = useState(null); // bayat veri uyarısı
  const [portfolioPerf, setPortfolioPerf] = useState(null);   // Strateji vs Al-ve-Tut (sepet)
  const [portfolioPerfRange, setPortfolioPerfRange] = useState("year");
  const [riskProfile, setRiskProfile] = useState("dengeli");   // muhafazakar | dengeli | agresif
  const [targets, setTargets] = useState({});
  const [portfolio, setPortfolio] = useState({});
  const [userId, setUserId] = useState(null);
  const [userStateReady, setUserStateReady] = useState(false);
  const [remoteStateEnabled, setRemoteStateEnabled] = useState(false);

  const mounted = useRef(true);
  const refreshInFlight = useRef(false);
  const latestNewsRef = useRef({});
  const latestCompanyRef = useRef({});
  const marketContextRef = useRef(null);
  const predictionLedgerRef = useRef({});
  const stateHydratedRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => { latestNewsRef.current = newsMap; }, [newsMap]);
  useEffect(() => { latestCompanyRef.current = companyMap; }, [companyMap]);
  useEffect(() => { marketContextRef.current = marketContext; }, [marketContext]);
  useEffect(() => { predictionLedgerRef.current = predictionLedger; }, [predictionLedger]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadUserState(DEFAULT_STOCKS).then(({ userId: nextUserId, remote, state }) => {
      if (cancelled || !mounted.current) return;
      setUserId(nextUserId);
      setRemoteStateEnabled(remote);
      setStocks(state.stocks);
      setTargets(state.targets);
      setPortfolio(state.portfolio);
      setNetTargetSettings(state.netTargetSettings);
      setPerfSnapshots(state.perfSnapshots);
      setMonthlyHistory(state.monthlyHistory);
      setPredictionLedger(state.predictionLedger);
      setRiskProfile(state.riskProfile);
      stateHydratedRef.current = true;
      setUserStateReady(true);
    }).catch(() => {
      if (cancelled || !mounted.current) return;
      stateHydratedRef.current = true;
      setUserStateReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userStateReady || !stateHydratedRef.current || !userId) return undefined;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const state = {
      stocks,
      targets,
      portfolio,
      netTargetSettings,
      perfSnapshots,
      monthlyHistory,
      predictionLedger,
      riskProfile,
    };
    saveTimeoutRef.current = setTimeout(() => {
      saveUserState(userId, state)
        .then(() => setRemoteStateEnabled(true))
        .catch(() => setRemoteStateEnabled(false));
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    userId,
    userStateReady,
    stocks,
    targets,
    portfolio,
    netTargetSettings,
    perfSnapshots,
    monthlyHistory,
    predictionLedger,
    riskProfile,
  ]);

  const handleTargetChange = (symbol, key, value) => {
    setTargets((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] || {}), [key]: value } }));
  };

  const handleTargetReset = (symbol, key) => {
    setTargets((prev) => {
      const nextSymbolTargets = { ...(prev[symbol] || {}) };
      delete nextSymbolTargets[key];
      const next = { ...prev };
      if (Object.keys(nextSymbolTargets).length) next[symbol] = nextSymbolTargets;
      else delete next[symbol];
      return next;
    });
  };

  const handlePortfolioChange = (symbol, key, value) => {
    setPortfolio((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] || {}), [key]: value } }));
  };

  const handleNetSettingChange = useCallback((key, value) => {
    setNetTargetSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const packageAndStore = useCallback((stock, hist, options = {}) => {
    const {
      stockNewsSentiment = 0,
      marketNewsSentiment = 0,
      company = null,
      market = null,
      isDemo = false,
    } = options;
    const learningRecords = predictionLedgerRef.current[stock.symbol] || [];
    const packaged = {
      ...packageHistory(hist, {
        stock,
        company,
        market,
        stockNewsSentiment,
        marketNewsSentiment,
        learningRecords,
      }),
      isDemo,
    };
    if (!mounted.current) return;
    setDataMap((m) => ({ ...m, [stock.symbol]: packaged }));
    setStatusMap((m) => ({ ...m, [stock.symbol]: "ready" }));
    setPredictionLedger((prev) => {
      const current = prev[stock.symbol] || [];
      const next = reconcilePredictionRecords(current, packaged, stock.symbol);
      if (JSON.stringify(current) === JSON.stringify(next)) return prev;
      return { ...prev, [stock.symbol]: next };
    });
  }, []);

  const loadStock = useCallback(async (stock, { includeNews = true, marketSnapshot = null } = {}) => {
    setStatusMap((m) => ({ ...m, [stock.symbol]: "loading" }));
    setErrorMap((m) => ({ ...m, [stock.symbol]: null }));
    if (includeNews) setNewsLoadingMap((m) => ({ ...m, [stock.symbol]: true }));
    try {
      let hist;
      let newsResult = latestNewsRef.current[stock.symbol] || null;
      let companyResult = latestCompanyRef.current[stock.symbol] || null;
      if (includeNews) {
        [hist, newsResult, companyResult] = await Promise.all([
          fetchStockHistory(stock.yahoo),
          fetchNews(stock.yahoo),
          fetchCompany(stock.yahoo),
        ]);
      } else {
        hist = await fetchStockHistory(stock.yahoo);
      }
      if (!mounted.current) return;
      if (includeNews) {
        setNewsMap((m) => {
          const next = { ...m, [stock.symbol]: newsResult };
          latestNewsRef.current = next;
          return next;
        });
        setCompanyMap((m) => {
          const next = { ...m, [stock.symbol]: companyResult };
          latestCompanyRef.current = next;
          return next;
        });
      }
      packageAndStore(stock, hist, {
        stockNewsSentiment: newsResult?.avgSentiment || 0,
        marketNewsSentiment: newsResult?.market?.avgSentiment || 0,
        company: companyResult,
        market: marketSnapshot || marketContextRef.current,
        isDemo: false,
      });
    } catch (e) {
      if (!mounted.current) return;
      setErrorMap((m) => ({ ...m, [stock.symbol]: e.message || "Veri alınamadı" }));
      setStatusMap((m) => ({ ...m, [stock.symbol]: "error" }));
    } finally {
      if (includeNews && mounted.current) {
        setNewsLoadingMap((m) => ({ ...m, [stock.symbol]: false }));
      }
    }
  }, [packageAndStore]);

  const loadDemo = useCallback((symbol) => {
    const stock = stocks.find((s) => s.symbol === symbol);
    const basePrices = { BIMAS: 490, BINHO: 9.5, EBEBK: 60 };
    const base = basePrices[symbol] || 100;
    const hist = generateDemoHistory(base);
    packageAndStore(stock, hist, {
      stockNewsSentiment: 0,
      marketNewsSentiment: 0,
      company: latestCompanyRef.current[symbol] || null,
      market: marketContextRef.current,
      isDemo: true,
    });
    setErrorMap((m) => ({ ...m, [symbol]: null }));
  }, [stocks, packageAndStore]);

  const loadAll = useCallback(async ({ includeNews = false } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const [fxRate, marketSnapshot] = await Promise.all([fetchUsdTry(), fetchMarketContext()]);
      await Promise.all(stocks.map((stock) => loadStock(stock, { includeNews, marketSnapshot })));
      if (!mounted.current) return;
      setUsdTry(fxRate);
      setMarketContext(marketSnapshot);
      setLastUpdate(new Date());
    } finally {
      refreshInFlight.current = false;
    }
  }, [stocks, loadStock]);

  useEffect(() => {
    if (!userStateReady) return undefined;
    loadAll({ includeNews: true });

    // Backend pipeline sinyallerini ve sistem durumunu çek (opsiyonel, mevcut işleyişi etkilemez)
    const loadPipelineData = () => {
      stocks.forEach((stock) => {
        fetchSignal(stock.symbol).then((sig) => {
          if (sig) setSignalMap((m) => ({ ...m, [stock.symbol]: sig }));
        });
      });
      fetchPipelineStatus().then((s) => {
        if (s) setPipelineStatus(s);
      });
    };
    loadPipelineData();
    const signalInterval = setInterval(loadPipelineData, 60 * 60 * 1000); // her saat yenile

    const fastInterval = setInterval(() => loadAll({ includeNews: false }), 60 * 1000);
    const newsInterval = setInterval(() => loadAll({ includeNews: true }), 15 * 60 * 1000);
    return () => {
      clearInterval(fastInterval);
      clearInterval(newsInterval);
      clearInterval(signalInterval);
    };
  }, [loadAll, userStateReady]);

  useEffect(() => {
    if (!userStateReady || !stocks.length) return;
    let cancelled = false;
    fetchPerformance(stocks.map((s) => s.symbol), portfolioPerfRange, riskProfile).then((p) => {
      if (!cancelled && p) setPortfolioPerf(p);
    });
    return () => { cancelled = true; };
  }, [stocks, portfolioPerfRange, riskProfile, userStateReady]);

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
    setCompanyMap((m) => { const n = { ...m }; delete n[symbol]; return n; });
    setPredictionLedger((m) => { const n = { ...m }; delete n[symbol]; return n; });
  };

  const items = stocks.map((stock) => ({ stock, data: dataMap[stock.symbol] }));
  const portfolioValue = useMemo(
    () => items.reduce((sum, { stock, data }) => {
      if (!data) return sum;
      const lots = parsePositiveNumber(portfolio[stock.symbol]?.lots);
      if (lots == null || lots <= 0) return sum;
      return sum + lots * data.price;
    }, 0),
    [items, portfolio]
  );
  const now = new Date();
  const currentMonthKey = monthKeyFromDate(now);
  const currentYearKey = yearKeyFromDate(now);

  useEffect(() => {
    if (!portfolioValue || portfolioValue <= 0) return;
    setPerfSnapshots((prev) => {
      const months = { ...(prev.months || {}) };
      const years = { ...(prev.years || {}) };
      let changed = false;
      if (!months[currentMonthKey]) {
        months[currentMonthKey] = { startValue: Number(portfolioValue.toFixed(2)), createdAt: new Date().toISOString() };
        changed = true;
      }
      if (!years[currentYearKey]) {
        years[currentYearKey] = { startValue: Number(portfolioValue.toFixed(2)), createdAt: new Date().toISOString() };
        changed = true;
      }
      return changed ? { months, years } : prev;
    });
  }, [portfolioValue, currentMonthKey, currentYearKey]);

  const monthlyStartValue = perfSnapshots.months?.[currentMonthKey]?.startValue ?? null;
  const yearlyStartValue = perfSnapshots.years?.[currentYearKey]?.startValue ?? null;
  const monthlyCost = parsePositiveNumber(netTargetSettings.monthlyCostsTl) || 0;
  const yearlyExtraCost = parsePositiveNumber(netTargetSettings.yearlyExtraCostsTl) || 0;
  const monthsElapsedThisYear = now.getMonth() + 1;
  const yearlyCostTotal = monthlyCost * monthsElapsedThisYear + yearlyExtraCost;

  const monthlyGrossTl = monthlyStartValue != null ? portfolioValue - monthlyStartValue : 0;
  const yearlyGrossTl = yearlyStartValue != null ? portfolioValue - yearlyStartValue : 0;
  const monthlyNetTl = monthlyGrossTl - monthlyCost;
  const yearlyNetTl = yearlyGrossTl - yearlyCostTotal;
  const monthlyNetPct = monthlyStartValue && monthlyStartValue > 0 ? (monthlyNetTl / monthlyStartValue) * 100 : null;
  const yearlyNetPct = yearlyStartValue && yearlyStartValue > 0 ? (yearlyNetTl / yearlyStartValue) * 100 : null;

  const monthlyTargetPctInput = parsePositiveNumber(netTargetSettings.monthlyTargetPct);
  const monthlyTargetTlInput = parsePositiveNumber(netTargetSettings.monthlyTargetTl);
  const yearlyTargetPctInput = parsePositiveNumber(netTargetSettings.yearlyTargetPct);
  const yearlyTargetTlInput = parsePositiveNumber(netTargetSettings.yearlyTargetTl);

  const monthlyTargetPct = monthlyTargetPctInput != null
    ? monthlyTargetPctInput
    : (monthlyTargetTlInput != null && monthlyStartValue > 0 ? (monthlyTargetTlInput / monthlyStartValue) * 100 : 0);
  const monthlyTargetTl = monthlyTargetTlInput != null
    ? monthlyTargetTlInput
    : (monthlyTargetPctInput != null && monthlyStartValue > 0 ? (monthlyStartValue * monthlyTargetPctInput) / 100 : 0);
  const yearlyTargetPct = yearlyTargetPctInput != null
    ? yearlyTargetPctInput
    : (yearlyTargetTlInput != null && yearlyStartValue > 0 ? (yearlyTargetTlInput / yearlyStartValue) * 100 : 0);
  const yearlyTargetTl = yearlyTargetTlInput != null
    ? yearlyTargetTlInput
    : (yearlyTargetPctInput != null && yearlyStartValue > 0 ? (yearlyStartValue * yearlyTargetPctInput) / 100 : 0);

  const handleMonthlyPctChange = useCallback((value) => {
    setNetTargetSettings((prev) => {
      const pct = parsePositiveNumber(value);
      if (value === "") return { ...prev, monthlyTargetPct: "", monthlyTargetTl: "" };
      if (pct == null) return { ...prev, monthlyTargetPct: value };
      const next = { ...prev, monthlyTargetPct: value };
      if (monthlyStartValue && monthlyStartValue > 0) next.monthlyTargetTl = ((monthlyStartValue * pct) / 100).toFixed(2);
      return next;
    });
  }, [monthlyStartValue]);

  const handleMonthlyTlChange = useCallback((value) => {
    setNetTargetSettings((prev) => {
      const tl = parsePositiveNumber(value);
      if (value === "") return { ...prev, monthlyTargetTl: "", monthlyTargetPct: "" };
      if (tl == null) return { ...prev, monthlyTargetTl: value };
      const next = { ...prev, monthlyTargetTl: value };
      if (monthlyStartValue && monthlyStartValue > 0) next.monthlyTargetPct = ((tl / monthlyStartValue) * 100).toFixed(2);
      return next;
    });
  }, [monthlyStartValue]);

  const handleYearlyPctChange = useCallback((value) => {
    setNetTargetSettings((prev) => {
      const pct = parsePositiveNumber(value);
      if (value === "") return { ...prev, yearlyTargetPct: "", yearlyTargetTl: "" };
      if (pct == null) return { ...prev, yearlyTargetPct: value };
      const next = { ...prev, yearlyTargetPct: value };
      if (yearlyStartValue && yearlyStartValue > 0) next.yearlyTargetTl = ((yearlyStartValue * pct) / 100).toFixed(2);
      return next;
    });
  }, [yearlyStartValue]);

  const handleYearlyTlChange = useCallback((value) => {
    setNetTargetSettings((prev) => {
      const tl = parsePositiveNumber(value);
      if (value === "") return { ...prev, yearlyTargetTl: "", yearlyTargetPct: "" };
      if (tl == null) return { ...prev, yearlyTargetTl: value };
      const next = { ...prev, yearlyTargetTl: value };
      if (yearlyStartValue && yearlyStartValue > 0) next.yearlyTargetPct = ((tl / yearlyStartValue) * 100).toFixed(2);
      return next;
    });
  }, [yearlyStartValue]);

  useEffect(() => {
    if (monthlyStartValue == null) return;
    setMonthlyHistory((prev) => {
      const existing = prev[currentMonthKey] || {};
      const nextEntry = {
        ...existing,
        monthKey: currentMonthKey,
        startValue: Number(monthlyStartValue.toFixed(2)),
        endValue: Number(portfolioValue.toFixed(2)),
        netTl: Number(monthlyNetTl.toFixed(2)),
        netPct: monthlyNetPct != null ? Number(monthlyNetPct.toFixed(3)) : null,
        targetTl: Number(monthlyTargetTl.toFixed(2)),
        targetPct: Number(monthlyTargetPct.toFixed(3)),
        monthlyCost: Number(monthlyCost.toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
      const same = JSON.stringify(existing) === JSON.stringify(nextEntry);
      if (same) return prev;
      return { ...prev, [currentMonthKey]: nextEntry };
    });
  }, [
    currentMonthKey, monthlyStartValue, portfolioValue, monthlyNetTl, monthlyNetPct,
    monthlyTargetTl, monthlyTargetPct, monthlyCost,
  ]);

  const chartRows = useMemo(
    () => Object.keys(monthlyHistory)
      .sort((a, b) => a.localeCompare(b))
      .slice(-12)
      .map((k) => ({ monthKey: k, ...(monthlyHistory[k] || {}) })),
    [monthlyHistory]
  );

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeftInMonth = Math.max(0, endOfMonth.getDate() - now.getDate());
  const requiredDailyTl = monthlyTargetTl > monthlyNetTl && daysLeftInMonth > 0
    ? (monthlyTargetTl - monthlyNetTl) / daysLeftInMonth
    : null;

  const detailItem = detailSymbol ? items.find((it) => it.stock.symbol === detailSymbol) : null;
  const detailManualTargets = detailSymbol ? (targets[detailSymbol] || {}) : {};
  const detailResolvedTargets = detailItem?.data ? resolveDisplayedTargets(detailItem.data.suggestedTargets, detailManualTargets) : {};

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
          manualTargets={detailManualTargets}
          resolvedTargets={detailResolvedTargets}
          predictionRecords={predictionLedger[detailSymbol] || []}
          onTargetChange={handleTargetChange}
          onTargetReset={handleTargetReset}
          portfolio={portfolio}
          onPortfolioChange={handlePortfolioChange}
          onClose={() => setDetailSymbol(null)}
          signalData={signalMap[detailSymbol] || null}
          perf={portfolioPerf}
          perfRange={portfolioPerfRange}
          onPerfRangeChange={setPortfolioPerfRange}
          riskProfile={riskProfile}
          onRiskProfileChange={setRiskProfile}
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

        <PortfolioPerformanceCard
          perf={portfolioPerf}
          range={portfolioPerfRange}
          onRangeChange={setPortfolioPerfRange}
          onSelectStock={setDetailSymbol}
        />

        {/* Uyarı */}
        <div className="rounded-lg px-3.5 py-2.5 mb-5 flex items-start gap-2"
          style={{ background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.25)` }}>
          <AlertTriangle size={14} style={{ color: C.amber, marginTop: 2, flexShrink: 0 }} />
          <p className="font-body text-[11px]" style={{ color: C.amber }}>
            Bu araç yatırım tavsiyesi vermez. Sinyaller teknik göstergelerin otomatik yorumudur. Kararlarınızı kendi araştırmanıza dayandırın.
          </p>
        </div>

        {/* Hisse kartları */}
        {pipelineStatus?.hoursSinceLastRun > 48 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
            style={{ background: "rgba(251,91,77,0.08)", border: `1px solid rgba(251,91,77,0.2)` }}>
            <AlertTriangle size={13} style={{ color: C.red, flexShrink: 0 }} />
            <span className="font-body text-[11px]" style={{ color: C.red }}>
              Model verileri {pipelineStatus.hoursSinceLastRun >= 48 ? `${Math.round(pipelineStatus.hoursSinceLastRun / 24)} gün` : `${pipelineStatus.hoursSinceLastRun} saat`} önce güncellendi. Pipeline çalışmıyor olabilir.
            </span>
          </div>
        )}

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
              manualTargets={targets[stock.symbol] || {}}
              resolvedTargets={data ? resolveDisplayedTargets(data.suggestedTargets, targets[stock.symbol] || {}) : {}}
              signalData={signalMap[stock.symbol] || null}
              riskProfile={riskProfile}
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
        <PortfolioSummary items={items} portfolio={portfolio} onSelectStock={setDetailSymbol} signalMap={signalMap} riskProfile={riskProfile} />

        <RiskProfileCard riskProfile={riskProfile} onChange={setRiskProfile} />

        <NetTargetPanel
          settings={netTargetSettings}
          onSettingsChange={handleNetSettingChange}
          onMonthlyPctChange={handleMonthlyPctChange}
          onMonthlyTlChange={handleMonthlyTlChange}
          onYearlyPctChange={handleYearlyPctChange}
          onYearlyTlChange={handleYearlyTlChange}
          summary={{
            portfolioValue,
            monthlyStartValue,
            yearlyStartValue,
            monthlyTargetPct,
            monthlyTargetTl,
            yearlyTargetPct,
            yearlyTargetTl,
            monthlyNetTl,
            monthlyNetPct,
            yearlyNetTl,
            yearlyNetPct,
            monthlyGrossTl,
            yearlyGrossTl,
            monthlyCost,
            yearlyCostTotal,
            daysLeftInMonth,
            requiredDailyTl,
            chartRows,
          }}
        />

        {lastUpdate && (
          <div className="font-mono text-[11px] text-center mt-5" style={{ color: C.faint }}>
            Son yenileme: {lastUpdate.toLocaleTimeString("tr-TR")} · {remoteStateEnabled ? "kalıcı backend aktif" : "yerel geçiş modu"} · backend snapshotları 1 dk görünüm, 15 dk haber döngüsüyle yenilenir
          </div>
        )}

        <div className="flex justify-center gap-3 mt-4 mb-6">
          <a
            href="/UYGULAMA.md"
            download="UYGULAMA.md"
            className="font-mono text-[11px] px-3 py-1 rounded"
            style={{ color: C.amber, border: `1px solid ${C.border}`, background: C.panel }}
          >
            ⬇ UYGULAMA.md
          </a>
          <a
            href="/README.md"
            download="README.md"
            className="font-mono text-[11px] px-3 py-1 rounded"
            style={{ color: C.muted, border: `1px solid ${C.border}`, background: C.panel }}
          >
            ⬇ README.md
          </a>
        </div>
      </div>
    </div>
  );
}
