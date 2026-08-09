"""
Haber sentiment skoru — api/_lib/providers.js'teki fetchNewsPayload'ın Python
portu (kelime listeleri ve combinedSentiment formülü birebir aynı).

Pipeline bağımsız çalışsın diye web tarafındaki market_snapshots önbelleğine
hiç bağımlı değildir; kendi RSS çekimini yapar. Herhangi bir hata durumunda
None döner — pipeline'ın geri kalanını asla çökertmez.
"""
import re

import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SinyalMasasi/1.0)"}

POSITIVE_WORDS = [
    "artış", "yükseliş", "rekor", "kâr", "büyüme", "güçlü", "olumlu", "başarı", "anlaşma",
    "temettü", "hedef", "yukarı", "pozitif", "beklenti", "aştı", "beat", "growth", "profit",
    "record", "rise", "gain", "strong", "positive", "deal", "dividend", "upgrade", "buy",
    "outperform", "rally", "surge", "bullish", "optimistic", "exceed", "revenue",
    "kazanç", "ihracat", "genişleme", "yatırım", "ortaklık",
]
NEGATIVE_WORDS = [
    "düşüş", "kayıp", "zarar", "uyarı", "risk", "kriz", "zayıf", "negatif", "sorun",
    "satış", "aşağı", "baskı", "endişe", "fall", "loss", "decline", "weak", "warning",
    "sell", "downgrade", "underperform", "drop", "slump", "bearish", "concern", "miss",
    "below", "cut", "reduce", "lawsuit", "fine", "penalty", "debt", "borç", "dava",
    "ceza", "faiz", "enflasyon", "inflation", "interest",
]

_ITEM_RE = re.compile(r"<item>([\s\S]*?)</item>")
_TITLE_CDATA_RE = re.compile(r"<title><!\[CDATA\[(.*?)\]\]></title>")
_TITLE_RE = re.compile(r"<title>(.*?)</title>")

STOCK_URLS = "https://finance.yahoo.com/rss/headline?s={symbol}"
STOCK_URLS_TR = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=TR&lang=tr-TR"
MARKET_URLS = [
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EXU100&region=TR&lang=tr-TR",
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EXU030&region=TR&lang=tr-TR",
]


def _sentiment_score(text):
    lower = text.lower()
    score = 0.0
    for word in POSITIVE_WORDS:
        if word in lower:
            score += 0.15
    for word in NEGATIVE_WORDS:
        if word in lower:
            score -= 0.15
    return max(-1.0, min(1.0, score))


def _parse_rss(xml):
    titles = []
    for block in _ITEM_RE.findall(xml):
        m = _TITLE_CDATA_RE.search(block) or _TITLE_RE.search(block)
        if m and m.group(1).strip():
            titles.append(m.group(1).strip())
    return titles


def _dedupe(titles):
    seen = set()
    out = []
    for t in titles:
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def _fetch_first_available(urls):
    for url in urls:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if not resp.ok:
                continue
            titles = _dedupe(_parse_rss(resp.text))
            if titles:
                return titles
        except Exception:
            continue
    return []


def _average_sentiment(scores):
    if not scores:
        return 0.0
    n = len(scores)
    numerator = sum(s * (n - idx) for idx, s in enumerate(scores))
    denominator = sum((n - idx) for idx in range(n))
    return numerator / denominator if denominator else 0.0


def fetch_news_sentiment(yahoo_symbol):
    """-1..1 arası birleşik haber sentiment skoru döner (%70 hisse + %30 piyasa).
    Herhangi bir hata durumunda None döner."""
    try:
        stock_titles = _fetch_first_available([
            STOCK_URLS.format(symbol=yahoo_symbol),
            STOCK_URLS_TR.format(symbol=yahoo_symbol),
        ])
        market_titles = _fetch_first_available(MARKET_URLS)

        stock_scores = [_sentiment_score(t) for t in stock_titles[:10]]
        market_scores = [_sentiment_score(t) for t in market_titles[:8]]

        avg_stock = _average_sentiment(stock_scores)
        avg_market = _average_sentiment(market_scores)
        combined = max(-1.0, min(1.0, avg_stock * 0.7 + avg_market * 0.3))
        return round(combined, 3)
    except Exception:
        return None
