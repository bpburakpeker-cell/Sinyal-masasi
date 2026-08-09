// Vercel Serverless Function — /api/news?symbol=BIMAS.IS
// Yahoo Finance RSS üzerinden haber çeker, sunucu taraflı CORS sorunu olmaz.
// API key gerekmez.

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
  POSITIVE_WORDS.forEach((w) => { if (lower.includes(w)) score += 0.15; });
  NEGATIVE_WORDS.forEach((w) => { if (lower.includes(w)) score -= 0.15; });
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
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)" },
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const parsed = dedupeItems(parseRSS(xml));
      if (parsed.length > 0) return parsed;
    } catch (_) {
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

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli" });
    return;
  }

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

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({
    items: scored,
    avgSentiment: Number(avgSentiment.toFixed(3)),
    market: {
      items: marketScored,
      avgSentiment: Number(marketSentiment.toFixed(3)),
    },
    combinedSentiment: Number(combinedSentiment.toFixed(3)),
  });
}
