"""
Model isabet yüzdesi hesaplama.
Son 60 işlem gününde, her modelin ürettiği sinyal ile gerçekleşen
fiyat hareketinin yönü karşılaştırılır.
"""


def compute_hit_rate(signal_rows, price_rows, lookahead=1):
    """
    signal_rows : [{ "date": date, "signal": "AL"|"SAT"|"BEKLE" }, ...]  (tarih artan)
    price_rows  : [{ "date": date, "close": float }, ...]                (tarih artan)

    lookahead   : kaç gün sonraki kapanışla karşılaştırılacak (varsayılan 1)
    Döner: (hit_rate_pct, sample_size)
      hit_rate_pct = None  eğer sample_size < 5
    """
    # Tarih → kapanış fiyatı sözlüğü
    price_map = {r["date"]: r["close"] for r in price_rows}
    dates_sorted = sorted(price_map.keys())

    hits = 0
    total = 0

    for row in signal_rows:
        sig = row.get("signal")
        if sig not in ("AL", "SAT"):
            continue   # BEKLE sinyalleri isabet hesabına dahil edilmez

        base_date = row["date"]
        idx = dates_sorted.index(base_date) if base_date in price_map else -1
        if idx < 0 or idx + lookahead >= len(dates_sorted):
            continue

        future_date  = dates_sorted[idx + lookahead]
        base_price   = price_map[base_date]
        future_price = price_map[future_date]

        actual_up = future_price > base_price

        if sig == "AL"  and actual_up:
            hits += 1
        elif sig == "SAT" and not actual_up:
            hits += 1
        total += 1

    if total < 5:
        return None, total

    return round(hits / total * 100, 1), total


def compute_model_return_metrics(score_hist, price_hist, buy=25, sell=-25):
    """
    Bir modelin KENDİ skorundan türetilen AL sinyaliyle pozisyona girip,
    sinyal AL olmaktan çıkınca çıkarak gerçekleşen ortalama getiriyi ölçer.
    Bu, compute_hit_rate'in ölçtüğü "yön doğru muydu"dan farklı olarak,
    gerçekte ne kadar kazandırdığını (veya kaybettirdiğini) gösterir.

    score_hist : [{ "date": date, "score": float }, ...]   (tarih artan)
    price_hist : [{ "date": date, "close": float }, ...]   (tarih artan)

    Döner: (avg_return_pct, trade_count) — hiç kapanmış işlem yoksa (None, 0)
    """
    price_map = {r["date"]: r["close"] for r in price_hist}
    score_map = {r["date"]: r["score"] for r in score_hist}
    dates_sorted = sorted(price_map.keys())

    in_position = False
    entry_price = None
    returns = []

    for d in dates_sorted:
        score = score_map.get(d)
        if score is None:
            continue
        price = price_map[d]
        signal = "AL" if score >= buy else ("SAT" if score <= sell else "BEKLE")

        if not in_position and signal == "AL":
            in_position = True
            entry_price = price
        elif in_position and signal != "AL":
            returns.append((price - entry_price) / entry_price * 100)
            in_position = False
            entry_price = None

    if not returns:
        return None, 0
    return round(sum(returns) / len(returns), 2), len(returns)
