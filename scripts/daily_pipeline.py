"""
Sinyal Masası — Günlük Pipeline Orkestrasyonu
Çalıştır: python scripts/daily_pipeline.py
"""
import sys
import traceback
from datetime import date

sys.path.insert(0, "scripts")

from lib.db import (
    start_pipeline_run, finish_pipeline_run,
    upsert_prices, upsert_features, upsert_model_scores,
    upsert_final_signal, upsert_model_performance,
    fetch_recent_prices, fetch_model_performance, upsert_weights_history,
    fetch_recent_model_scores, fetch_recent_final_scores,
)
from lib.fetch_yahoo   import fetch_ohlcv
from lib.indicators    import technical_score, sma_series, rsi_series, macd_series, bollinger_series, obv_series
from lib.regime        import estimate_volatility, detect_regime, volatility_score
from lib.relative_strength import relative_strength_score
from lib.ensemble      import combine_scores, signal_from_score, apply_confirmation_filter
from lib.performance   import compute_hit_rate, compute_model_return_metrics

# ── Hisse tanımları ────────────────────────────────────────────────────────────
CORE_STOCKS = [
    {"symbol": "BIMAS", "yahoo": "BIMAS.IS", "sector": "Perakende"},
    {"symbol": "BINHO", "yahoo": "BINHO.IS", "sector": "Holding"},
    {"symbol": "EBEBK", "yahoo": "EBEBK.IS", "sector": "Perakende"},
]

PEER_MAP = {
    "Perakende": ["MGROS.IS", "SOKM.IS"],
    "Holding":   ["DOHOL.IS", "ALARK.IS"],
}


def run_pipeline():
    run_id = start_pipeline_run()
    processed = []
    errors    = []

    try:
        # Emsal hisselerin kapanış verisi (göreli güç için)
        print("Emsal hisse verileri çekiliyor...")
        peer_closes = {}
        all_peer_syms = list({s for v in PEER_MAP.values() for s in v})
        for psym in all_peer_syms:
            try:
                rows = fetch_ohlcv(psym, range_str="1mo")
                peer_closes[psym] = [r["close"] for r in rows]
            except Exception as e:
                print(f"  {psym} emsal veri hatası (görmezden gelindi): {e}")
                peer_closes[psym] = []

        for stock in CORE_STOCKS:
            symbol = stock["symbol"]
            yahoo  = stock["yahoo"]
            sector = stock["sector"]
            print(f"\n── {symbol} işleniyor ──")

            try:
                # 1) Son günlük veriyi çek
                rows = fetch_ohlcv(yahoo, range_str="2d")
                if not rows:
                    raise ValueError("Boş veri")

                today_row = rows[-1]
                today     = today_row["date"]
                print(f"   Tarih: {today}  Kapanış: {today_row['close']:.2f}")

                # DB'e yaz
                upsert_prices([{"symbol": symbol, **today_row}])

                # 2) Geçmiş fiyatlar (hesaplama için)
                db_rows = fetch_recent_prices(symbol, days=252)
                if len(db_rows) < 60:
                    raise ValueError(f"Yetersiz geçmiş ({len(db_rows)} gün)")

                closes  = [float(r["close"]) for r in db_rows]
                volumes = [int(r["volume"]) if r["volume"] else 0 for r in db_rows]
                dates   = [r["date"] for r in db_rows]

                # 3) Göstergeler
                sma20 = sma_series(closes, 20)
                sma50 = sma_series(closes, 50)
                rsi   = rsi_series(closes, 14)
                macd  = macd_series(closes)
                boll  = bollinger_series(closes, 20)
                obv   = obv_series(closes, volumes)
                last  = len(closes) - 1

                volatility = estimate_volatility(closes)
                regime     = detect_regime(closes, sma20, sma50, volatility)

                # Emsal kapanışlar
                peer_syms = PEER_MAP.get(sector, [])
                peers_data = [peer_closes.get(p, []) for p in peer_syms if peer_closes.get(p)]
                rel_str    = relative_strength_score(closes, peers_data, window=20)

                # Features kaydı
                feat = {
                    "symbol":        symbol,
                    "date":          today,
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
                }
                upsert_features([feat])

                # 4) Model skorları
                t_score = technical_score(closes, volumes)
                v_score = volatility_score(closes)
                r_score = rel_str

                scores = {
                    "technical":        t_score,
                    "volatility":       v_score,
                    "relative_strength": r_score,
                }
                upsert_model_scores([
                    {"symbol": symbol, "date": today, "model_key": k, "score": s}
                    for k, s in scores.items()
                ])

                # 5) Ensemble — rejim ağırlıklarını, her modelin güncel isabet
                # oranına göre yumuşak bir güven çarpanıyla ayarla
                performance = fetch_model_performance(symbol)
                final_score, weights = combine_scores(scores, regime, performance)
                raw_signal = signal_from_score(final_score)

                # Tutarlılık filtresi: önceki 2 günün HAM sinyali gerekir (onaylanmış
                # final_signals.signal değil — aksi halde BEKLE kendini doğrulayan bir
                # tuzağa döner). Ham sinyal saklanmıyor, ama final_score'dan yeniden
                # türetilebilir.
                recent_scores = fetch_recent_final_scores(symbol, days=2)
                recent_sigs = [
                    signal_from_score(float(r["final_score"]))
                    for r in sorted(recent_scores, key=lambda x: x["date"])
                ]
                confirmed_signal, confirmed = apply_confirmation_filter(raw_signal, recent_sigs)

                signal_row = {
                    "symbol":              symbol,
                    "date":                today,
                    "final_score":         round(final_score, 2),
                    "signal":              confirmed_signal,
                    "regime":              regime,
                    "weight_technical":    weights["technical"],
                    "weight_volatility":   weights["volatility"],
                    "weight_rel_strength": weights["relative_strength"],
                    "confirmed":           confirmed,
                }
                upsert_final_signal(signal_row)

                upsert_weights_history([{
                    "symbol": symbol, "date": today, "regime": regime,
                    "weight_technical":    weights["technical"],
                    "weight_volatility":   weights["volatility"],
                    "weight_rel_strength": weights["relative_strength"],
                }])

                # 6) Performans güncelle — her modelin KENDİ skor geçmişinden türetilen
                # sinyalle (final_signals değil) ölçülür, aksi halde üç model de aynı
                # birleşik sinyali kullanıp hep aynı isabet oranını üretir.
                price_hist  = [{"date": r["date"], "close": float(r["close"])} for r in db_rows]

                for model_key in ("technical", "volatility", "relative_strength"):
                    score_hist = fetch_recent_model_scores(symbol, model_key, days=60)
                    model_sig_hist = [
                        {"date": r["date"], "signal": signal_from_score(float(r["score"]))}
                        for r in score_hist
                    ]
                    hit, n = compute_hit_rate(model_sig_hist, price_hist)

                    score_hist_f = [{"date": r["date"], "score": float(r["score"])} for r in score_hist]
                    avg_return, trade_count = compute_model_return_metrics(score_hist_f, price_hist)

                    upsert_model_performance(symbol, model_key, hit, n, avg_return, trade_count)

                print(f"   → Sinyal: {confirmed_signal} (skor: {final_score:.1f}, rejim: {regime})")
                processed.append(symbol)

            except Exception as e:
                print(f"   HATA: {e}")
                traceback.print_exc()
                errors.append({"symbol": symbol, "error": str(e)})

        status = "success" if not errors else "partial"
        finish_pipeline_run(run_id, status, {
            "processed": processed,
            "errors":    errors,
            "date":      str(date.today()),
        })
        print(f"\n✓ Pipeline tamamlandı. İşlenen: {processed}, Hata: {[e['symbol'] for e in errors]}")

    except Exception as e:
        traceback.print_exc()
        finish_pipeline_run(run_id, "error", {"error": str(e)})
        sys.exit(1)


if __name__ == "__main__":
    run_pipeline()
