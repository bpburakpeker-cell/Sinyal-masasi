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

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    res.status(400).json({ error: "symbol parametresi gerekli" });
    return;
  }

  // Yahoo Finance RSS — ek haber kaynağı olarak Finans haberleri de deneyelim
  const urls = [
    `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(symbol)}`,
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=TR&lang=tr-TR`,
  ];

  let items = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)" },
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const parsed = parseRSS(xml);
      if (parsed.length > 0) { items = parsed; break; }
    } catch (_) {
      // sonraki kaynağa geç
    }
  }

  // Her habere sentiment skoru ekle
  const scored = items.slice(0, 10).map((item) => ({
    ...item,
    sentiment: sentimentScore(item.title),
  }));

  // Genel sentiment: son haberlerin ağırlıklı ortalaması (yeniler daha ağırlıklı)
  const avgSentiment = scored.length
    ? scored.reduce((sum, it, idx) => sum + it.sentiment * (scored.length - idx), 0) /
      scored.reduce((sum, _, idx) => sum + (scored.length - idx), 0)
    : 0;

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({ items: scored, avgSentiment: Number(avgSentiment.toFixed(3)) });
}
