"""
Yahoo Finance'ten günlük OHLCV verisi çekme.
Sembol formatı: BIMAS.IS, BINHO.IS, EBEBK.IS
"""
import time
import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

ENDPOINTS = [
    "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d",
]


def fetch_ohlcv(yahoo_symbol, range_str="1y", retries=3, backoff=2.0):
    """
    Belirtilen sembole ait günlük OHLCV listesi döner.
    Her eleman: { date, open, high, low, close, volume }
    """
    last_err = None
    for attempt in range(retries):
        for endpoint_tpl in ENDPOINTS:
            url = endpoint_tpl.format(symbol=yahoo_symbol, range=range_str)
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                data = resp.json()
                rows = _parse_chart(data, yahoo_symbol)
                if rows:
                    return rows
            except Exception as e:
                last_err = e
        time.sleep(backoff * (attempt + 1))

    raise RuntimeError(
        f"{yahoo_symbol} için veri alınamadı ({retries} deneme): {last_err}"
    )


def _parse_chart(data, symbol):
    result = data.get("chart", {}).get("result", [None])[0]
    if not result:
        return []

    timestamps = result.get("timestamp", [])
    quote = result.get("indicators", {}).get("quote", [{}])[0]
    opens   = quote.get("open",   [])
    highs   = quote.get("high",   [])
    lows    = quote.get("low",    [])
    closes  = quote.get("close",  [])
    volumes = quote.get("volume", [])

    rows = []
    for i, ts in enumerate(timestamps):
        c = closes[i] if i < len(closes) else None
        if c is None:
            continue
        from datetime import datetime, timezone
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).date()
        rows.append({
            "date":   dt,
            "open":   opens[i]   if i < len(opens)   else None,
            "high":   highs[i]   if i < len(highs)   else None,
            "low":    lows[i]    if i < len(lows)     else None,
            "close":  c,
            "volume": volumes[i] if i < len(volumes)  else None,
        })
    return rows
