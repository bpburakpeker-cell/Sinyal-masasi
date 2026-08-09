"""
Piyasa bağlamı — XU100'ün 20 günlük % değişimi. api/_lib/providers.js'teki
fetchMarketPayload/pctChange mantığının odaklı bir portu. Run başına bir kez
çağrılır, tüm semboller arasında paylaşılır. Hata durumunda None döner.

Not: Yahoo'nun "^XU100" endeks sembolü chart endpoint'inde boş veri
döndürüyor (muhtemelen crumb/oturum kısıtlaması) — "XU100.IS" (hisse gibi
işlem gören ETF/endeks temsili) aynı chart endpoint'inde veri döndürüyor,
bu yüzden o kullanılıyor.
"""
import requests

from .fetch_yahoo import HEADERS

URL = "https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?range=3mo&interval=1d"


def _pct_change(closes, lookback):
    if len(closes) <= lookback:
        return None
    latest = closes[-1]
    prev = closes[-1 - lookback]
    if prev in (None, 0):
        return None
    return ((latest - prev) / prev) * 100


def fetch_market_context():
    """Döner: {"xu100_change_20d": float|None}. Hata durumunda değer None olur."""
    try:
        resp = requests.get(URL, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        result = (data.get("chart") or {}).get("result") or [None]
        result = result[0]
        if not result:
            return {"xu100_change_20d": None}

        closes_raw = (result.get("indicators") or {}).get("quote", [{}])[0].get("close", [])
        closes = [c for c in closes_raw if isinstance(c, (int, float))]
        return {"xu100_change_20d": _pct_change(closes, 20)}
    except Exception:
        return {"xu100_change_20d": None}
