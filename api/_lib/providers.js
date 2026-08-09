function raw(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object" && "raw" in v) return v.raw ?? fallback;
  return v;
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)",
      Accept: "application/json, text/plain, */*",
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchQuotePayload(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  return fetchJson(url);
}

export async function fetchFxPayload() {
  const sources = [
    async () => {
      const data = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY");
      return data?.rates?.TRY;
    },
    async () => {
      const data = await fetchJson("https://open.er-api.com/v6/latest/USD");
      return data?.rates?.TRY;
    },
  ];

  for (const source of sources) {
    try {
      const rate = await source();
      if (rate) return { rate };
    } catch {
      // sıradaki kaynağa geç
    }
  }

  throw new Error("USD/TRY kuru alınamadı");
}

const POSITIVE_WORDS = [
  "artış","yükseliş","rekor","kâr","büyüme","güçlü","olumlu","başarı","anlaşma",
  "temettü","hedef","yukarı","pozitif","beklenti","aştı","beat","growth","profit",
  "record","rise","gain","strong","positive","deal","dividend","upgrade","buy",
  "outperform","rally","surge","bullish","optimistic","exceed","beat","revenue",
  "kazanç","ihracat","genişleme","yatırım","ortaklık",
];
const NEGATIVE_WORDS = [
  "düşüş","kayıp","zarar","uyarı","risk","kriz","zayıf","negatif","sorun",
  "satış","aşağı","baskı","endişe","fall","loss","decline","weak","warning",
  "sell","downgrade","underperform","drop","slump","bearish","concern","miss",
  "below","cut","reduce","lawsuit","fine","penalty","debt","borç","dava",
  "ceza","faiz","enflasyon","inflation","interest",
];

function sentimentScore(text) {
  const lower = text.toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach((word) => { if (lower.includes(word)) score += 0.15; });
  NEGATIVE_WORDS.forEach((word) => { if (lower.includes(word)) score -= 0.15; });
  return Math.max(-1, Math.min(1, score));
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block) || [])[1] || "";
    const link = (/<link>(.*?)<\/link>/.exec(block) || [])[1] || "";
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block) || [])[1] || "";
    const source = (/<source[^>]*>(.*?)<\/source>/.exec(block) || [])[1] || "";
    if (title) items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim(), source: source.trim() });
  }
  return items;
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.title}|${item.link}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFirstAvailable(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)" },
      });
      if (!response.ok) continue;
      const xml = await response.text();
      const parsed = dedupeItems(parseRSS(xml));
      if (parsed.length > 0) return parsed;
    } catch {
      // sonraki kaynağa geç
    }
  }
  return [];
}

function scoreItems(items, limit = 10) {
  return items.slice(0, limit).map((item) => ({
    ...item,
    sentiment: sentimentScore(item.title),
  }));
}

function averageSentiment(items) {
  if (!items.length) return 0;
  const numerator = items.reduce((sum, it, idx) => sum + it.sentiment * (items.length - idx), 0);
  const denominator = items.reduce((sum, _, idx) => sum + (items.length - idx), 0);
  return denominator ? numerator / denominator : 0;
}

export async function fetchNewsPayload(symbol) {
  const stockUrls = [
    `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(symbol)}`,
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=TR&lang=tr-TR`,
  ];
  const marketUrls = [
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EXU100&region=TR&lang=tr-TR",
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EXU030&region=TR&lang=tr-TR",
  ];

  const [stockItems, marketItems] = await Promise.all([
    fetchFirstAvailable(stockUrls),
    fetchFirstAvailable(marketUrls),
  ]);

  const scored = scoreItems(stockItems, 10);
  const marketScored = scoreItems(marketItems, 8);
  const avgSentiment = averageSentiment(scored);
  const marketSentiment = averageSentiment(marketScored);
  const combinedSentiment = Math.max(-1, Math.min(1, avgSentiment * 0.7 + marketSentiment * 0.3));

  return {
    items: scored,
    avgSentiment: Number(avgSentiment.toFixed(3)),
    market: {
      items: marketScored,
      avgSentiment: Number(marketSentiment.toFixed(3)),
    },
    combinedSentiment: Number(combinedSentiment.toFixed(3)),
  };
}

export async function fetchCompanyPayload(symbol) {
  const modules = [
    "assetProfile",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "price",
    "calendarEvents",
  ].join(",");

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const json = await fetchJson(url);
  const result = json?.quoteSummary?.result?.[0];
  if (!result) throw new Error("Şirket verisi boş döndü");

  const asset = result.assetProfile || {};
  const summary = result.summaryDetail || {};
  const financial = result.financialData || {};
  const calendar = result.calendarEvents || {};
  const earningsDate = calendar?.earnings?.earningsDate?.[0];

  return {
    symbol,
    sector: asset.sector || null,
    industry: asset.industry || null,
    businessSummary: asset.longBusinessSummary || null,
    fullTimeEmployees: raw(asset.fullTimeEmployees),
    officersCount: Array.isArray(asset.companyOfficers) ? asset.companyOfficers.length : 0,
    dividendYield: raw(summary.dividendYield),
    payoutRatio: raw(summary.payoutRatio),
    beta: raw(summary.beta),
    trailingPE: raw(summary.trailingPE),
    marketCap: raw(summary.marketCap) ?? raw(result.price?.marketCap),
    profitMargins: raw(financial.profitMargins),
    operatingMargins: raw(financial.operatingMargins),
    grossMargins: raw(financial.grossMargins),
    earningsGrowth: raw(financial.earningsGrowth),
    revenueGrowth: raw(financial.revenueGrowth),
    returnOnEquity: raw(financial.returnOnEquity),
    debtToEquity: raw(financial.debtToEquity),
    recommendationMean: raw(financial.recommendationMean),
    recommendationKey: financial.recommendationKey || null,
    numberOfAnalystOpinions: raw(financial.numberOfAnalystOpinions),
    currentPrice: raw(financial.currentPrice) ?? raw(result.price?.regularMarketPrice),
    targetMeanPrice: raw(financial.targetMeanPrice),
    targetHighPrice: raw(financial.targetHighPrice),
    targetLowPrice: raw(financial.targetLowPrice),
    totalCash: raw(financial.totalCash),
    totalDebt: raw(financial.totalDebt),
    earningsTimestamp: raw(earningsDate),
  };
}

function pctChange(closes, lookback) {
  if (!Array.isArray(closes) || closes.length <= lookback) return 0;
  const latest = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lookback];
  if (!Number.isFinite(latest) || !Number.isFinite(prev) || prev === 0) return 0;
  return ((latest - prev) / prev) * 100;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  const closesRaw = result?.indicators?.quote?.[0]?.close || [];
  const timestamps = result?.timestamp || [];
  const rows = timestamps.map((t, i) => ({ t, c: closesRaw[i] })).filter((row) => Number.isFinite(row.c));
  return {
    symbol,
    closes: rows.map((row) => row.c),
    dates: rows.map((row) => new Date(row.t * 1000).toISOString()),
  };
}

function compactSeries(series) {
  const closes = series.closes || [];
  const latest = closes[closes.length - 1] ?? null;
  return {
    symbol: series.symbol,
    latest,
    change5d: pctChange(closes, 5),
    change20d: pctChange(closes, 20),
    change60d: pctChange(closes, 60),
  };
}

export async function fetchMarketPayload() {
  const [xu100, usdtry] = await Promise.all([
    fetchChart("^XU100"),
    fetchChart("TRY=X"),
  ]);

  return {
    xu100: compactSeries(xu100),
    usdTry: compactSeries(usdtry),
    updatedAt: new Date().toISOString(),
  };
}
