"""
Teknik indikatörler + Trend & Momentum Model skoru.
App.jsx'teki istemci tarafı mantığının Python kopyası.
OBV hacim doğrulama katmanı eklenmiştir.
"""
import math


# ── Yardımcı serileri ──────────────────────────────────────────────────────────

def sma_series(closes, period):
    out = [None] * len(closes)
    s = 0.0
    for i, c in enumerate(closes):
        s += c
        if i >= period:
            s -= closes[i - period]
        if i >= period - 1:
            out[i] = s / period
    return out


def ema_series(closes, period):
    out = [None] * len(closes)
    k = 2.0 / (period + 1)
    for i, c in enumerate(closes):
        if i == period - 1:
            out[i] = sum(closes[:period]) / period
        elif i >= period:
            out[i] = c * k + out[i - 1] * (1 - k)
    return out


def rsi_series(closes, period=14):
    out = [None] * len(closes)
    avg_gain = avg_loss = 0.0
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = max(diff, 0)
        loss = max(-diff, 0)
        if i <= period:
            avg_gain += gain / period
            avg_loss += loss / period
            if i == period:
                out[i] = 100 - 100 / (1 + avg_gain / max(avg_loss, 1e-10))
        else:
            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period
            out[i] = 100 - 100 / (1 + avg_gain / max(avg_loss, 1e-10))
    return out


def macd_series(closes, fast=12, slow=26, signal_period=9):
    ema_fast = ema_series(closes, fast)
    ema_slow = ema_series(closes, slow)
    macd_line = [
        (f - s) if f is not None and s is not None else None
        for f, s in zip(ema_fast, ema_slow)
    ]
    valid_start = next((i for i, v in enumerate(macd_line) if v is not None), None)
    if valid_start is None:
        return {"macd_line": macd_line, "signal_line": [None] * len(closes), "hist": [None] * len(closes)}

    compact = [v for v in macd_line if v is not None]
    signal_compact = ema_series(compact, signal_period)
    signal_line = [None] * len(closes)
    for i, sc in enumerate(signal_compact):
        if sc is not None:
            signal_line[valid_start + i] = sc

    hist = [
        (m - s) if m is not None and s is not None else None
        for m, s in zip(macd_line, signal_line)
    ]
    return {"macd_line": macd_line, "signal_line": signal_line, "hist": hist}


def bollinger_series(closes, period=20, k=2.0):
    sma = sma_series(closes, period)
    upper = [None] * len(closes)
    lower = [None] * len(closes)
    pos   = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        sl = closes[i - period + 1: i + 1]
        mean = sma[i]
        std = math.sqrt(sum((v - mean) ** 2 for v in sl) / period)
        upper[i] = mean + k * std
        lower[i] = mean - k * std
        rng = upper[i] - lower[i]
        pos[i] = (closes[i] - lower[i]) / rng if rng > 0 else 0.5
    return {"upper": upper, "lower": lower, "pos": pos}


def obv_series(closes, volumes):
    """On-Balance Volume ve 20-gün EMA'sı (OBV signal)."""
    obv = [0.0] * len(closes)
    for i in range(1, len(closes)):
        v = volumes[i] or 0
        if closes[i] > closes[i - 1]:
            obv[i] = obv[i - 1] + v
        elif closes[i] < closes[i - 1]:
            obv[i] = obv[i - 1] - v
        else:
            obv[i] = obv[i - 1]
    signal = ema_series(obv, 20)
    return {"obv": obv, "signal": signal}


# ── Kırpma ────────────────────────────────────────────────────────────────────

def clip(v, lo, hi):
    return max(lo, min(hi, v))


# ── Trend & Momentum skoru ────────────────────────────────────────────────────

def technical_score(closes, volumes, warmup=50):
    """
    Tek bir skor döner: -100..100
    volumes: None içerebilir, None'lar 0 sayılır
    """
    n = len(closes)
    if n < warmup:
        return 0.0

    vols = [v if v is not None else 0 for v in volumes]

    sma20 = sma_series(closes, 20)
    sma50 = sma_series(closes, 50)
    rsi   = rsi_series(closes, 14)
    macd  = macd_series(closes)
    boll  = bollinger_series(closes, 20)
    obv   = obv_series(closes, vols)

    last = n - 1

    # 1) MA sinyal (-1 / 0 / +1)
    s_ma = 0.0
    if sma20[last] is not None and sma50[last] is not None:
        diff_pct = (sma20[last] - sma50[last]) / max(sma50[last], 1e-9)
        s_ma = clip(diff_pct * 10, -1, 1)

    # 2) RSI sinyal
    s_rsi = 0.0
    if rsi[last] is not None:
        r = rsi[last]
        if r < 30:
            s_rsi = clip((30 - r) / 30, 0, 1)
        elif r > 70:
            s_rsi = clip((70 - r) / 30, -1, 0)
        else:
            s_rsi = clip((r - 50) / 20 * 0.5, -0.5, 0.5)

    # 3) MACD histogram sinyal
    s_macd = 0.0
    h = macd["hist"]
    if h[last] is not None and last >= 1 and h[last - 1] is not None:
        s_macd = clip(h[last] * 5, -1, 1)
        if h[last] > h[last - 1]:
            s_macd = min(s_macd + 0.2, 1)
        elif h[last] < h[last - 1]:
            s_macd = max(s_macd - 0.2, -1)

    # 4) Bollinger konumu
    s_boll = 0.0
    if boll["pos"][last] is not None:
        p = boll["pos"][last]
        if p > 0.8:
            s_boll = -0.5
        elif p < 0.2:
            s_boll = 0.5
        else:
            s_boll = (0.5 - p) * 0.5

    # 5) OBV onayı (hacim yönünün fiyat yönüyle uyumu)
    s_obv = 0.0
    o = obv["obv"]
    os_ = obv["signal"]
    if os_[last] is not None and o[last] is not None:
        obv_diff = (o[last] - os_[last]) / (abs(os_[last]) + 1e-9)
        s_obv = clip(obv_diff, -1, 1)

    # Ağırlıklı toplam
    score = (
        s_ma   * 30 +
        s_rsi  * 25 +
        s_macd * 25 +
        s_boll * 10 +
        s_obv  * 10
    )
    return clip(score, -100, 100)
