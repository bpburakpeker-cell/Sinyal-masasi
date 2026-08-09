"""
Madde 4 — Daha geniş sepette walk-forward doğrulama.

scripts/walk_forward_validate.py sadece 3 çekirdek hissede (BIMAS/BINHO/
EBEBK) çalışıyor — istatistiksel olarak güvenmek için küçük bir örneklem.
Bu script, pipeline'da zaten emsal olarak kullanılan 4 hisseyi (MGROS,
SOKM, DOHOL, ALARK) de dahil ederek aynı doğrulamayı 7 hissede tekrarlar.

SALT OKUNUR: hiçbir tabloya yazmaz. Yahoo Finance'ten taze veri çekip
scripts/backfill.py'nin dry_run=True moduyla bellekte hesaplar, DB'ye hiç
dokunmaz. Canlı uygulamayı etkilemez.

Çalıştır: DATABASE_URL=... python scripts/validate_wider_universe.py
(DATABASE_URL sadece scripts/lib/db.py'nin bağlantı açabilmesi için
gerekli — bu script'in kendisi DB'ye yazmaz.)
"""
import sys

sys.path.insert(0, "scripts")

from backfill import backfill_symbol
from lib.fetch_yahoo import fetch_ohlcv
from lib.walkforward import evaluate_symbol, MODEL_KEYS

# Sonuçlar görülmeden ÖNCE belirlenmiş sabit sektör-üyelik haritası.
# backfill.py'nin kendi PEER_MAP'ine dokunmaz (üretim davranışı etkilenmez) —
# sadece bu doğrulama script'i için daha geniş, sektöre göre tam bir emsal
# grubu tanımlar.
SECTOR_MEMBERS = {
    "Perakende": ["BIMAS.IS", "EBEBK.IS", "MGROS.IS", "SOKM.IS"],
    "Holding":   ["BINHO.IS", "DOHOL.IS", "ALARK.IS"],
}

VALIDATION_UNIVERSE = [
    {"symbol": "BIMAS", "yahoo": "BIMAS.IS", "sector": "Perakende"},
    {"symbol": "EBEBK", "yahoo": "EBEBK.IS", "sector": "Perakende"},
    {"symbol": "MGROS", "yahoo": "MGROS.IS", "sector": "Perakende"},
    {"symbol": "SOKM",  "yahoo": "SOKM.IS",  "sector": "Perakende"},
    {"symbol": "BINHO", "yahoo": "BINHO.IS", "sector": "Holding"},
    {"symbol": "DOHOL", "yahoo": "DOHOL.IS", "sector": "Holding"},
    {"symbol": "ALARK", "yahoo": "ALARK.IS", "sector": "Holding"},
]


def to_walkforward_inputs(dry_run_result):
    """backfill_symbol(dry_run=True) çıktısını evaluate_symbol'ün beklediği şekle çevirir."""
    feature_rows = dry_run_result["feature_rows"]
    score_rows = dry_run_result["score_rows"]
    dates = dry_run_result["dates"]
    closes = dry_run_result["closes"]

    regime_by_date = {r["date"]: r["regime"] for r in feature_rows}
    price_map = {d: c for d, c in zip(dates, closes)}
    score_map_by_model = {k: {} for k in MODEL_KEYS}
    for r in score_rows:
        if r["model_key"] in score_map_by_model:
            score_map_by_model[r["model_key"]][r["date"]] = r["score"]
    return regime_by_date, price_map, score_map_by_model


def main():
    print("=== Madde 4: Daha Geniş Sepette Walk-Forward Doğrulama ===")
    print(f"Evren: {len(VALIDATION_UNIVERSE)} hisse (3 çekirdek + 4 emsal). Salt okunur, DB'ye yazmaz.\n")

    all_tickers = sorted({s for members in SECTOR_MEMBERS.values() for s in members})
    print("Sektör emsalleri çekiliyor...")
    peer_closes = {}
    for t in all_tickers:
        try:
            rows = fetch_ohlcv(t, range_str="1y")
            peer_closes[t] = [float(r["close"]) for r in rows]
            print(f"  {t}: {len(rows)} gün")
        except Exception as e:
            print(f"  {t} HATA: {e}")
            peer_closes[t] = []

    results = []
    for stock in VALIDATION_UNIVERSE:
        try:
            peer_syms = [s for s in SECTOR_MEMBERS.get(stock["sector"], []) if s != stock["yahoo"]]
            dry_run_result = backfill_symbol(stock["symbol"], stock["yahoo"], peer_syms, peer_closes, dry_run=True)
            if not dry_run_result:
                print(f"{stock['symbol']}: veri alınamadı, atlandı.\n")
                continue

            regime_by_date, price_map, score_map_by_model = to_walkforward_inputs(dry_run_result)
            result = evaluate_symbol(regime_by_date, price_map, score_map_by_model)
            if result is None:
                print(f"{stock['symbol']}: yetersiz veri, atlandı.\n")
                continue

            result["symbol"] = stock["symbol"]
            results.append(result)
        except Exception as e:
            print(f"{stock['symbol']}: HATA — {e}\n")

    print("\n=== Sonuçlar ===")
    diffs = []
    for r in results:
        b, t = r["base"], r["trust"]
        b_ret = b["ret"] if b["ret"] is not None else 0.0
        t_ret = t["ret"] if t["ret"] is not None else 0.0
        diff = round(t_ret - b_ret, 2)
        diffs.append(diff)
        print(f"── {r['symbol']} ── (eğitim: {r['train_days']} gün, test: {r['test_days']} gün)")
        print(f"  Rejim-only   : isabet={b['hit']}   n={b['n']}   ort.getiri=%{b['ret']}   işlem={b['trades']}")
        print(f"  Güven skorlu : isabet={t['hit']}   n={t['n']}   ort.getiri=%{t['ret']}   işlem={t['trades']}")
        print(f"  Fark (getiri): {'+' if diff >= 0 else ''}{diff}")
        print()

    print("=== Agregat Özet ===")
    if not diffs:
        print("Hiçbir hisse için yeterli veri bulunamadı.")
        return

    pos = sum(1 for d in diffs if d > 0)
    neg = sum(1 for d in diffs if d < 0)
    neutral = sum(1 for d in diffs if d == 0)
    avg_diff = round(sum(diffs) / len(diffs), 2)
    print(f"{len(diffs)} hisse değerlendirildi.")
    print(f"Güven skoru daha iyi: {pos}  ·  daha kötü: {neg}  ·  fark yok: {neutral}")
    print(f"Ortalama getiri farkı (güven skorlu - rejim-only): {'+' if avg_diff >= 0 else ''}{avg_diff} puan")
    print("\nNot: tek bir eğitim/test bölünmesi ve sınırlı örneklem — bu yön gösterir, kesin kanıt değildir.")


if __name__ == "__main__":
    main()
