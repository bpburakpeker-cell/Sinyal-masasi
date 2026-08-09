"""
Paylaşımlı walk-forward doğrulama yardımcıları.

scripts/walk_forward_validate.py (3 çekirdek hisse, DB'den okur) ve
scripts/validate_wider_universe.py (daha geniş sepet, Yahoo'dan taze
hesaplar, DB'ye yazmaz) bu modülü ortak kullanır — böylece onay filtresi
mantığı (özellikle "ham sinyal geçmişi kullanılmalı, onaylanmış değil"
kritik detayı) tek bir yerde yaşar.
"""
from lib.ensemble import combine_scores, signal_from_score, apply_confirmation_filter
from lib.performance import compute_hit_rate, compute_model_return_metrics

TRAIN_FRACTION = 0.7
MODEL_KEYS = ("technical", "volatility", "relative_strength")
MIN_TOTAL_DAYS = 80
MIN_TEST_DAYS = 20


def build_performance_from_window(score_map_by_model, price_map, dates):
    """Verilen tarih aralığından (ör. sadece eğitim dönemi) model_performance benzeri bir sözlük üretir."""
    performance = {}
    for model_key in MODEL_KEYS:
        score_by_date = score_map_by_model[model_key]
        sig_hist = [{"date": d, "signal": signal_from_score(score_by_date[d])} for d in dates if d in score_by_date]
        price_hist = [{"date": d, "close": price_map[d]} for d in dates if d in price_map]
        hit, n = compute_hit_rate(sig_hist, price_hist)
        performance[model_key] = {"hit_rate_pct": hit, "sample_size": n}
    return performance


def simulate(dates, regime_by_date, score_map_by_model, performance):
    """Gün gün combine_scores + onay filtresi uygulayıp final_score/confirmed_signal serisini üretir.
    Onay penceresi HAM sinyal geçmişini kullanır (onaylanmışı değil — aksi halde
    BEKLE kendini doğrulayan bir tuzağa döner, bkz. ensemble.py'deki not)."""
    signal_rows, score_rows = [], []
    raw_hist = []
    for d in dates:
        if d not in regime_by_date:
            continue
        scores = {k: score_map_by_model[k].get(d) for k in MODEL_KEYS}
        if any(v is None for v in scores.values()):
            continue
        final_score, _ = combine_scores(scores, regime_by_date[d], performance)
        raw = signal_from_score(final_score)
        confirmed, _ = apply_confirmation_filter(raw, raw_hist[-2:])
        raw_hist.append(raw)
        signal_rows.append({"date": d, "signal": confirmed})
        score_rows.append({"date": d, "score": final_score})
    return signal_rows, score_rows


def evaluate_symbol(regime_by_date, price_map, score_map_by_model, train_fraction=TRAIN_FRACTION):
    """
    Tek bir sembol için eğitim/test walk-forward'ı çalıştırır: rejim-only
    ağırlıklar vs. (sadece eğitimden hesaplanmış) güven skorlu ağırlıklar.

    Döner: sonuç sözlüğü, ya da veri yetersizse None.
    """
    all_dates = sorted(regime_by_date.keys())
    if len(all_dates) < MIN_TOTAL_DAYS:
        return None
    split_idx = int(len(all_dates) * train_fraction)
    train_dates, test_dates = all_dates[:split_idx], all_dates[split_idx:]
    if len(test_dates) < MIN_TEST_DAYS:
        return None

    performance_from_train = build_performance_from_window(score_map_by_model, price_map, train_dates)
    test_price_hist = [{"date": d, "close": price_map[d]} for d in test_dates if d in price_map]

    base_sig, base_score = simulate(test_dates, regime_by_date, score_map_by_model, None)
    base_hit, base_n = compute_hit_rate(base_sig, test_price_hist)
    base_ret, base_trades = compute_model_return_metrics(base_score, test_price_hist)

    trust_sig, trust_score = simulate(test_dates, regime_by_date, score_map_by_model, performance_from_train)
    trust_hit, trust_n = compute_hit_rate(trust_sig, test_price_hist)
    trust_ret, trust_trades = compute_model_return_metrics(trust_score, test_price_hist)

    return {
        "train_days": len(train_dates),
        "test_days": len(test_dates),
        "base":  {"hit": base_hit, "n": base_n, "ret": base_ret, "trades": base_trades},
        "trust": {"hit": trust_hit, "n": trust_n, "ret": trust_ret, "trades": trust_trades},
    }
