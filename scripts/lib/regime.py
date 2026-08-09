"""
GARCH(1,1) volatilite tahmini + kural tabanlı rejim tespiti.
"""
import numpy as np

try:
    from arch import arch_model
    HAS_ARCH = True
except ImportError:
    HAS_ARCH = False


def estimate_volatility(closes, window=60):
    """
    Son `window` günün günlük getirilerinden GARCH(1,1) ile
    bir sonraki günün volatilite tahminini döner (günlük std, %).
    arch paketi yoksa rolling std kullanır.
    """
    if len(closes) < max(window, 30):
        returns = np.diff(np.log(np.array(closes, dtype=float) + 1e-9)) * 100
        return float(np.std(returns)) if len(returns) > 0 else 1.0

    returns = np.diff(np.log(np.array(closes[-window - 1:], dtype=float) + 1e-9)) * 100

    if HAS_ARCH:
        try:
            am = arch_model(returns, vol="Garch", p=1, q=1, dist="normal", rescale=False)
            res = am.fit(disp="off", show_warning=False)
            forecast = res.forecast(horizon=1, reindex=False)
            vol = float(np.sqrt(forecast.variance.values[-1, 0]))
            return vol
        except Exception:
            pass

    # Fallback: rolling std
    return float(np.std(returns[-20:]))


def detect_regime(closes, sma20, sma50, volatility):
    """
    Basit kural tabanlı rejim tespiti.
    Döner: 'trend_up' | 'trend_down' | 'sideways' | 'high_volatility'
    """
    last = len(closes) - 1

    # Uzun vadeli oynaklık referansı (son 252 gün rolling std)
    n = min(252, len(closes))
    rets = np.diff(np.log(np.array(closes[-n - 1:], dtype=float) + 1e-9)) * 100
    long_vol = float(np.std(rets)) if len(rets) >= 10 else 1.5

    vol_ratio = volatility / max(long_vol, 0.1)

    if vol_ratio > 1.8:
        return "high_volatility"

    if sma20[last] is None or sma50[last] is None:
        return "sideways"

    ma_diff_pct = (sma20[last] - sma50[last]) / max(sma50[last], 1e-9)

    if ma_diff_pct > 0.015:
        return "trend_up"
    elif ma_diff_pct < -0.015:
        return "trend_down"
    else:
        return "sideways"


def volatility_score(closes, window=60):
    """
    Risk & Oynaklık Modeli skoru: -100..100
    Yüksek oynaklık → merkeze çeker (negatif skor = belirsizlik).
    Düşük oynaklık + yukarı trend → pozitif katkı.
    """
    vol = estimate_volatility(closes, window)

    # Normalize: tipik günlük vol %1-3 arasıdır
    # %1'in altı düşük, %3'ün üstü yüksek
    normalized = (vol - 1.0) / 2.0   # 0 = normal, >1 = çok yüksek
    raw = -clip(normalized, -1, 1) * 60   # yüksek vol → negatif

    # Trend yönü katkısı (±20)
    if len(closes) >= 20:
        trend_20 = (closes[-1] - closes[-20]) / max(closes[-20], 1e-9)
        raw += clip(trend_20 * 4, -20, 20)

    return clip(raw, -100, 100)


def clip(v, lo, hi):
    return max(lo, min(hi, v))
