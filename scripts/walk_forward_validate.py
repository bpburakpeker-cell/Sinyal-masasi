"""
Walk-forward doğrulama.

Güven skorlu ağırlıklandırmanın (scripts/lib/ensemble.py) gerçekten
görülmemiş (out-of-sample) veride yardımcı olup olmadığını dürüstçe test
eder — sadece backfill'e bakıp "iyi görünüyor" demek yerine.

Salt okunur: hiçbir tabloya yazmaz. Manuel çalıştırılır:
    DATABASE_URL=... python scripts/walk_forward_validate.py

Yöntem (scripts/lib/walkforward.py'de detaylı): tarihe göre %70 eğitim /
%30 test böler, güven skoru sadece eğitimden hesaplanır (sızıntı yok),
test döneminde rejim-only vs güven-skorlu karşılaştırılır.

Not: elimizde ~1 yıllık veri var, bu yüzden tek bir eğitim/test bölünmesi
yapılıyor (çok katlı değil). Sonuçlar yönü gösterir, kesin istatistiksel
kanıt değildir — n sınırlıdır. Daha geniş bir sepette aynı doğrulama için
bkz. scripts/validate_wider_universe.py.
"""
import sys

sys.path.insert(0, "scripts")

import psycopg2.extras

from lib.db import get_connection
from lib.walkforward import evaluate_symbol, MODEL_KEYS

CORE_STOCKS = ["BIMAS", "BINHO", "EBEBK"]


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


def main():
    print("=== Walk-Forward Doğrulama (out-of-sample) ===")
    print("Not: elimizdeki veriyle tek bir eğitim/test bölünmesi yapılıyor — yön gösterir, kesin kanıt değildir.\n")

    for symbol in CORE_STOCKS:
        features, scores, prices = fetch_symbol_history(symbol)
        regime_by_date = {r["date"]: r["regime"] for r in features}
        price_map = {r["date"]: float(r["close"]) for r in prices}
        score_map_by_model = {k: {} for k in MODEL_KEYS}
        for r in scores:
            if r["model_key"] in score_map_by_model:
                score_map_by_model[r["model_key"]][r["date"]] = float(r["score"])

        result = evaluate_symbol(regime_by_date, price_map, score_map_by_model)
        if result is None:
            print(f"{symbol}: yetersiz veri, atlandı.\n")
            continue

        b, t = result["base"], result["trust"]
        print(f"── {symbol} ── (eğitim: {result['train_days']} gün, test/out-of-sample: {result['test_days']} gün)")
        print(f"  Rejim-only   : isabet={b['hit']}   n={b['n']}   ort.getiri=%{b['ret']}   işlem={b['trades']}")
        print(f"  Güven skorlu : isabet={t['hit']}   n={t['n']}   ort.getiri=%{t['ret']}   işlem={t['trades']}")
        print()


if __name__ == "__main__":
    main()
