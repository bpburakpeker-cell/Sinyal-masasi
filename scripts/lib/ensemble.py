"""
Ensemble: üç modeli rejime göre ağırlıklandır + sinyal tutarlılık filtresi.
"""

# Rejim → model ağırlıkları
REGIME_WEIGHTS = {
    "trend_up":        {"technical": 0.50, "volatility": 0.30, "relative_strength": 0.20},
    "trend_down":      {"technical": 0.50, "volatility": 0.30, "relative_strength": 0.20},
    "sideways":        {"technical": 0.35, "volatility": 0.35, "relative_strength": 0.30},
    "high_volatility": {"technical": 0.25, "volatility": 0.55, "relative_strength": 0.20},
}
DEFAULT_WEIGHTS = {"technical": 0.40, "volatility": 0.40, "relative_strength": 0.20}

BUY_THRESHOLD  =  25
SELL_THRESHOLD = -25


def combine_scores(scores, regime):
    """
    scores: { "technical": float, "volatility": float, "relative_strength": float }
    Döner: (final_score, signal, weights_used)
    """
    weights = REGIME_WEIGHTS.get(regime, DEFAULT_WEIGHTS)
    final = sum(scores.get(k, 0) * w for k, w in weights.items())
    final = max(-100, min(100, final))
    return final, weights


def signal_from_score(score):
    if score >= BUY_THRESHOLD:
        return "AL"
    if score <= SELL_THRESHOLD:
        return "SAT"
    return "BEKLE"


def apply_confirmation_filter(signal, recent_signals):
    """
    Sinyal tutarlılık filtresi: son 3 günün sinyali tutarsızsa BEKLE'ye çek.
    recent_signals: son 3 günün sinyal listesi (eski→yeni, örn. ['AL','AL','SAT'])
    signal: bugünkü ham sinyal
    """
    if len(recent_signals) < 3:
        return signal, False   # yeterli geçmiş yok — filtreleme yok

    # Son 2 gün + bugün
    window = list(recent_signals[-2:]) + [signal]

    unique = set(window)
    if len(unique) == 1:
        # Üç gün aynı → güçlü sinyal, onayla
        return signal, True

    # Karışık sinyal → BEKLE'ye çek
    return "BEKLE", False
