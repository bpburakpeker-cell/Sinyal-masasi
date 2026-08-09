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

# Güven çarpanı ayarları: hit_rate %50 → çarpan 1.0 (nötr). Sapma başına ne kadar
# güçlü tepki verileceği ve izin verilen maksimum sapma burada sınırlanır.
TRUST_SENSITIVITY = 1.0    # (hit_rate - 50) / 100 * TRUST_SENSITIVITY
TRUST_MAX_DEVIATION = 0.30  # çarpan [0.70, 1.30] aralığına sıkıştırılır
TRUST_MIN_SAMPLE = 5        # bu örneklemin altında veri "yetersiz" sayılır, çarpan nötr kalır

# Bayes (Beta-Binom) küçültmesi: ham hit_rate yerine, %50'de nötr bir prior'a
# doğru çekilmiş bir tahmin kullanılır. k = sanal gözlem sayısı — n küçükken
# (ör. n=6, %16.7) tahmini şansa yakın tutar; n büyüdükçe ham orana yaklaşır.
# Bu olmadan küçük örneklemler gerçekte kanıtlanmamış performansa göre orantısız
# ağırlık kazanıp/kaybediyordu.
TRUST_PRIOR_STRENGTH = 10


def _shrink_hit_rate(hit_rate_pct, sample_size, k=TRUST_PRIOR_STRENGTH):
    """Ham isabet yüzdesini örneklem büyüklüğüne duyarlı şekilde %50'ye doğru küçültür."""
    wins = hit_rate_pct / 100.0 * sample_size
    shrunk = (wins + k * 0.5) / (sample_size + k)
    return shrunk * 100.0


def compute_trust_multipliers(performance):
    """
    performance: { model_key: {"hit_rate_pct": float|None, "sample_size": int} }
    Döner: { model_key: float }  — 1.0 nötr, >1.0 daha fazla güven, <1.0 daha az güven.

    Veri yetersizken (örneklem < TRUST_MIN_SAMPLE veya hit_rate yok) modele
    müdahale edilmez — rejim tablosundaki ağırlık aynen kullanılır. Yeterli
    örneklemde bile ham oran yerine küçültülmüş (shrunk) oran kullanılır.
    """
    performance = performance or {}
    multipliers = {}
    for model_key, perf in performance.items():
        hit_rate    = perf.get("hit_rate_pct") if perf else None
        sample_size = perf.get("sample_size", 0) if perf else 0
        if hit_rate is None or sample_size < TRUST_MIN_SAMPLE:
            multipliers[model_key] = 1.0
            continue
        shrunk_pct = _shrink_hit_rate(hit_rate, sample_size)
        deviation = max(-TRUST_MAX_DEVIATION, min(TRUST_MAX_DEVIATION, (shrunk_pct - 50) / 100 * TRUST_SENSITIVITY))
        multipliers[model_key] = 1.0 + deviation
    return multipliers


def combine_scores(scores, regime, performance=None):
    """
    scores: { "technical": float, "volatility": float, "relative_strength": float }
    performance: opsiyonel — { model_key: {"hit_rate_pct": float|None, "sample_size": int} }
                 verilirse, rejim ağırlıkları her modelin gerçek güncel isabet oranına
                 göre yumuşak bir şekilde (±%30 içinde) yeniden ölçeklenir.
    Döner: (final_score, weights_used) — weights_used, DB'ye yazılan ve UI'da
           gösterilen *efektif* ağırlıklardır.
    """
    base_weights = REGIME_WEIGHTS.get(regime, DEFAULT_WEIGHTS)

    if performance:
        trust = compute_trust_multipliers(performance)
        adjusted = {k: base_weights[k] * trust.get(k, 1.0) for k in base_weights}
        total = sum(adjusted.values()) or 1.0
        weights = {k: v / total for k, v in adjusted.items()}
    else:
        weights = base_weights

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
    Sinyal tutarlılık filtresi: son 3 günün (bugün + önceki 2 gün) sinyali
    tutarsızsa BEKLE'ye çek.

    ÖNEMLİ: recent_signals, önceki günlerin HAM (filtrelenmemiş) sinyalleri
    olmalı — ONAYLANMIŞ/filtrelenmiş sinyal değil. Onaylanmış sinyal
    beslenirse, iki gün üst üste BEKLE çıktığında sistem sonsuza kadar
    BEKLE'de kilitlenir (BEKLE kendi kendini doğrulayan bir tuzağa döner,
    çünkü sonraki günün penceresi de en az bir BEKLE içerir ve asla "hepsi
    aynı" olamaz). Bu yüzden çağıranlar ham sinyal geçmişini ayrıca tutmalı.

    recent_signals: önceki günlerin HAM sinyal listesi (eski→yeni); fonksiyon
    bunun sadece son 2 elemanını kullanır.
    signal: bugünkü ham sinyal
    """
    if len(recent_signals) < 2:
        return signal, False   # yeterli geçmiş yok (< 2 önceki gün) — filtreleme yok

    # Son 2 gün + bugün
    window = list(recent_signals[-2:]) + [signal]

    unique = set(window)
    if len(unique) == 1:
        # Üç gün aynı → güçlü sinyal, onayla
        return signal, True

    # Karışık sinyal → BEKLE'ye çek
    return "BEKLE", False
