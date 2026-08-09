"""
Walk-forward doğrulama.

Güven skorlu ağırlıklandırmanın (scripts/lib/ensemble.py) gerçekten
görülmemiş (out-of-sample) veride yardımcı olup olmadığını dürüstçe test
eder — sadece backfill'e bakıp "iyi görünüyor" demek yerine.

Salt okunur: hiçbir tabloya yazmaz. Manuel çalıştırılır:
    DATABASE_URL=... python scripts/walk_forward_validate.py

Yöntem: her sembolün geçmişini tarihe göre %70 eğitim / %30 test olarak
böler. Güven skoru SADECE eğitim döneminden hesaplanır (test dönemine hiç
bakmaz — sızıntı yok). Test döneminde iki senaryo karşılaştırılır:
  (a) rejim-only ağırlıklar (güven skoru kapalı)
  (b) güven skorlu ağırlıklar (yalnızca eğitimden öğrenilmiş)

Not: elimizde ~1 yıllık veri var, bu yüzden tek bir eğitim/test bölünmesi
yapılıyor (çok katlı değil). Sonuçlar yönü gösterir, kesin istatistiksel
kanıt değildir — n sınırlıdır.
"""
import sys

sys.path.insert(0, "scripts")

import psycopg2.extras

from lib.db import get_connection
from lib.ensemble import combine_scores, signal_from_score, apply_confirmation_filter
from lib.performance import compute_hit_rate, compute_model_return_metrics

CORE_STOCKS = ["BIMAS", "BINHO", "EBEBK"]
TRAIN_FRACTION = 0.7
MODEL_KEYS = ("technical", "volatility", "relative_strength")


def fetch_symbol_history(symbol):
    conn = get_connection()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT date, regime FROM features WHERE symbol=%s ORDER BY date ASC", (symbol,))
        features = cur.fetchall()
        cur.execute("SELECT date, model_key, score FROM model_scores WHERE symbol=%s ORDER BY date ASC", (symbol,))
        scores = cur.fetchall()
        cur.execute("SELECT date, close FROM prices WHERE symbol=%s ORDER BY date ASC", (symbol,))
        prices = cur.fetchall()
    return features, scores, prices


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


def main():
    print("=== Walk-Forward Doğrulama (out-of-sample) ===")
    print("Not: elimizdeki veriyle tek bir eğitim/test bölünmesi yapılıyor — yön gösterir, kesin kanıt değildir.\n")

    for symbol in CORE_STOCKS:
        features, scores, prices = fetch_symbol_history(symbol)
        if len(features) < 80:
            print(f"{symbol}: yetersiz veri ({len(features)} gün), atlandı.\n")
            continue

        regime_by_date = {r["date"]: r["regime"] for r in features}
        price_map = {r["date"]: float(r["close"]) for r in prices}
        score_map_by_model = {k: {} for k in MODEL_KEYS}
        for r in scores:
            if r["model_key"] in score_map_by_model:
                score_map_by_model[r["model_key"]][r["date"]] = float(r["score"])

        all_dates = sorted(regime_by_date.keys())
        split_idx = int(len(all_dates) * TRAIN_FRACTION)
        train_dates, test_dates = all_dates[:split_idx], all_dates[split_idx:]

        if len(test_dates) < 20:
            print(f"{symbol}: test dönemi çok kısa ({len(test_dates)} gün), atlandı.\n")
            continue

        performance_from_train = build_performance_from_window(score_map_by_model, price_map, train_dates)
        test_price_hist = [{"date": d, "close": price_map[d]} for d in test_dates if d in price_map]

        base_sig, base_score = simulate(test_dates, regime_by_date, score_map_by_model, None)
        base_hit, base_n = compute_hit_rate(base_sig, test_price_hist)
        base_ret, base_trades = compute_model_return_metrics(base_score, test_price_hist)

        trust_sig, trust_score = simulate(test_dates, regime_by_date, score_map_by_model, performance_from_train)
        trust_hit, trust_n = compute_hit_rate(trust_sig, test_price_hist)
        trust_ret, trust_trades = compute_model_return_metrics(trust_score, test_price_hist)

        print(f"── {symbol} ── (eğitim: {len(train_dates)} gün, test/out-of-sample: {len(test_dates)} gün)")
        print(f"  Rejim-only   : isabet={base_hit}   n={base_n}   ort.getiri=%{base_ret}   işlem={base_trades}")
        print(f"  Güven skorlu : isabet={trust_hit}   n={trust_n}   ort.getiri=%{trust_ret}   işlem={trust_trades}")
        print()


if __name__ == "__main__":
    main()
