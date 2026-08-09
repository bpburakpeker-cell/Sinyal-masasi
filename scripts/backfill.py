"""
Tek seferlik backfill: son 252 günün verisini çekip DB'ye yazar.
Çalıştır (bir kez): DATABASE_URL=... python scripts/backfill.py

İsabet yüzdelerinin hesaplanabilmesi için bu adım zorunludur.
"""
import sys
import traceback

sys.path.insert(0, "scripts")

from lib.db import (
    upsert_prices, upsert_features, upsert_model_scores,
    upsert_final_signal, upsert_model_performance,
)
from lib.fetch_yahoo       import fetch_ohlcv
from lib.indicators        import technical_score, sma_series, rsi_series, macd_series, bollinger_series, obv_series
from lib.regime            import estimate_volatility, detect_regime, volatility_score
from lib.relative_strength import relative_strength_score
from lib.ensemble          import combine_scores, signal_from_score, apply_confirmation_filter
from lib.performance       import compute_hit_rate

CORE_STOCKS = [
    {"symbol": "BIMAS", "yahoo": "BIMAS.IS", "sector": "Perakende"},
    {"symbol": "BINHO", "yahoo": "BINHO.IS", "sector": "Holding"},
    {"symbol": "EBEBK", "yahoo": "EBEBK.IS", "sector": "Perakende"},
]

PEER_MAP = {
    "Perakende": ["MGROS.IS", "SOKM.IS"],
    "Holding":   ["DOHOL.IS", "ALARK.IS"],
}


def backfill_symbol(symbol, yahoo, sector, peer_closes):
    print(f"\n── {symbol} backfill başlıyor ──")
    rows = fetch_ohlcv(yahoo, range_str="1y")
    if len(rows) < 60:
        print(f"  Yetersiz veri ({len(rows)} gün), atlandı.")
        return

    # Fiyatları toplu yaz
    price_rows = [{"symbol": symbol, **r} for r in rows]
    upsert_prices(price_rows)
    print(f"  {len(rows)} gün fiyat yazıldı.")

    closes  = [float(r["close"]) for r in rows]
    volumes = [int(r["volume"]) if r["volume"] else 0 for r in rows]
    dates   = [r["date"] for r in rows]

    peer_syms  = PEER_MAP.get(sector, [])
    peers_data = [peer_closes.get(p, []) for p in peer_syms if peer_closes.get(p)]

    feature_rows   = []
    score_rows     = []
    signal_rows_db = []
    signal_hist    = []   # (date, signal) geçmişi tutarlılık için

    warmup = 50
    for i in range(warmup, len(closes)):
        sub_closes  = closes[:i + 1]
        sub_volumes = volumes[:i + 1]
        d           = dates[i]

        sma20 = sma_series(sub_closes, 20)
        sma50 = sma_series(sub_closes, 50)
        rsi   = rsi_series(sub_closes, 14)
        macd  = macd_series(sub_closes)
        boll  = bollinger_series(sub_closes, 20)
        obv   = obv_series(sub_closes, sub_volumes)
        last  = len(sub_closes) - 1

        volatility = estimate_volatility(sub_closes)
        regime     = detect_regime(sub_closes, sma20, sma50, volatility)

        sub_peers = [p[-len(sub_closes):] if len(p) >= len(sub_closes) else p for p in peers_data]
        rel_str   = relative_strength_score(sub_closes, sub_peers, window=20)

        feature_rows.append({
            "symbol":        symbol,
            "date":          d,
            "sma20":         sma20[last],
            "sma50":         sma50[last],
            "rsi":           rsi[last],
            "macd_hist":     macd["hist"][last],
            "bollinger_pos": boll["pos"][last],
            "obv":           obv["obv"][last],
            "obv_signal":    obv["signal"][last],
            "regime":        regime,
            "volatility":    volatility,
            "rel_strength":  rel_str,
        })

        t_score = technical_score(sub_closes, sub_volumes)
        v_score = volatility_score(sub_closes)

        scores = {
            "technical":         t_score,
            "volatility":        v_score,
            "relative_strength": rel_str,
        }
        for k, s in scores.items():
            score_rows.append({"symbol": symbol, "date": d, "model_key": k, "score": s})

        final_score, weights = combine_scores(scores, regime)
        raw_signal  = signal_from_score(final_score)
        recent_sigs = [s for _, s in signal_hist[-2:]]
        confirmed_signal, confirmed = apply_confirmation_filter(raw_signal, recent_sigs)
        signal_hist.append((d, confirmed_signal))

        signal_rows_db.append({
            "symbol":              symbol,
            "date":                d,
            "final_score":         round(final_score, 2),
            "signal":              confirmed_signal,
            "regime":              regime,
            "weight_technical":    weights["technical"],
            "weight_volatility":   weights["volatility"],
            "weight_rel_strength": weights["relative_strength"],
            "confirmed":           confirmed,
        })

    # Toplu yaz
    upsert_features(feature_rows)
    print(f"  {len(feature_rows)} gün feature yazıldı.")

    # model_scores toplu
    for row in score_rows:
        pass  # batch yerine tek tek (veya 500'lük dilimler)
    # 500'er dilimde yaz
    for i in range(0, len(score_rows), 500):
        upsert_model_scores(score_rows[i:i + 500])
    print(f"  {len(score_rows)} model skor yazıldı.")

    for row in signal_rows_db:
        upsert_final_signal(row)
    print(f"  {len(signal_rows_db)} sinyal yazıldı.")

    # Performans hesapla
    price_hist_map = [{"date": r["close"], "close": float(r["close"])} for r in rows]
    price_hist_map = [{"date": dates[i], "close": closes[i]} for i in range(len(closes))]

    for model_key in ("technical", "volatility", "relative_strength"):
        last_60_sigs = [{"date": r["date"], "signal": r["signal"]} for r in signal_rows_db[-60:]]
        last_60_prices = [{"date": dates[i], "close": closes[i]} for i in range(max(0, len(closes) - 61), len(closes))]
        hit, n = compute_hit_rate(last_60_sigs, last_60_prices)
        upsert_model_performance(symbol, model_key, hit, n)
        print(f"  {model_key}: isabet=%{hit}  n={n}")

    print(f"  {symbol} backfill tamamlandı ✓")


def main():
    print("=== Sinyal Masası Backfill ===")

    # Emsal fiyatları çek
    print("\nEmsal hisseler çekiliyor...")
    peer_closes = {}
    all_peers = list({s for v in PEER_MAP.values() for s in v})
    for psym in all_peers:
        try:
            rows = fetch_ohlcv(psym, range_str="1y")
            peer_closes[psym] = [float(r["close"]) for r in rows]
            print(f"  {psym}: {len(rows)} gün")
        except Exception as e:
            print(f"  {psym} HATA: {e}")
            peer_closes[psym] = []

    errors = []
    for stock in CORE_STOCKS:
        try:
            backfill_symbol(stock["symbol"], stock["yahoo"], stock["sector"], peer_closes)
        except Exception as e:
            traceback.print_exc()
            errors.append({"symbol": stock["symbol"], "error": str(e)})

    if errors:
        print(f"\nHatalar: {errors}")
        sys.exit(1)
    else:
        print("\n=== Backfill başarıyla tamamlandı ===")


if __name__ == "__main__":
    main()
