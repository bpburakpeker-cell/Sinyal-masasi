"""
Göreli Güç Modeli — emsal hisselere göre rölatif performans skoru.
"""
import numpy as np


def relative_strength_score(closes_target, closes_peers, window=20):
    """
    closes_target : hedef hissenin kapanış listesi (en az window+1 eleman)
    closes_peers  : [ [peer1_closes], [peer2_closes], ... ]
    Döner: -100..100 skoru
    """
    if len(closes_target) < window + 1 or not closes_peers:
        return 0.0

    def pct_change(arr, w):
        arr = np.array(arr, dtype=float)
        if len(arr) < w + 1:
            return 0.0
        return (arr[-1] - arr[-w - 1]) / max(abs(arr[-w - 1]), 1e-9)

    target_ret = pct_change(closes_target, window)

    peer_rets = []
    for peer in closes_peers:
        if peer and len(peer) >= window + 1:
            peer_rets.append(pct_change(peer, window))

    if not peer_rets:
        return 0.0

    peer_avg = float(np.mean(peer_rets))
    # Fark: hedef ne kadar daha iyi/kötü?
    diff = target_ret - peer_avg

    # %5 üstünlük → +100, %-5 gerilik → -100 olarak ölçekle
    score = diff / 0.05 * 100
    return float(np.clip(score, -100, 100))
