"""
DB bağlantısı ve upsert yardımcıları.
DATABASE_URL ortam değişkeninden bağlantı bilgisi okunur.
"""
import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

_conn = None


def get_connection():
    global _conn
    if _conn is None or _conn.closed:
        url = os.environ["DATABASE_URL"]
        _conn = psycopg2.connect(url, sslmode="require")
        _conn.autocommit = False
    return _conn


@contextmanager
def transaction():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def upsert_prices(rows):
    """rows: list of dicts with keys symbol, date, open, high, low, close, volume"""
    if not rows:
        return
    with transaction() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO prices (symbol, date, open, high, low, close, volume)
                VALUES %s
                ON CONFLICT (symbol, date) DO UPDATE SET
                  open   = EXCLUDED.open,
                  high   = EXCLUDED.high,
                  low    = EXCLUDED.low,
                  close  = EXCLUDED.close,
                  volume = EXCLUDED.volume
                """,
                [
                    (r["symbol"], r["date"], r.get("open"), r.get("high"),
                     r.get("low"), r["close"], r.get("volume"))
                    for r in rows
                ],
            )


def upsert_features(rows):
    """rows: list of dicts — keys match features table columns"""
    if not rows:
        return
    with transaction() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO features
                  (symbol, date, sma20, sma50, rsi, macd_hist, bollinger_pos,
                   obv, obv_signal, regime, volatility, rel_strength)
                VALUES %s
                ON CONFLICT (symbol, date) DO UPDATE SET
                  sma20         = EXCLUDED.sma20,
                  sma50         = EXCLUDED.sma50,
                  rsi           = EXCLUDED.rsi,
                  macd_hist     = EXCLUDED.macd_hist,
                  bollinger_pos = EXCLUDED.bollinger_pos,
                  obv           = EXCLUDED.obv,
                  obv_signal    = EXCLUDED.obv_signal,
                  regime        = EXCLUDED.regime,
                  volatility    = EXCLUDED.volatility,
                  rel_strength  = EXCLUDED.rel_strength
                """,
                [
                    (
                        r["symbol"], r["date"],
                        r.get("sma20"), r.get("sma50"), r.get("rsi"),
                        r.get("macd_hist"), r.get("bollinger_pos"),
                        r.get("obv"), r.get("obv_signal"),
                        r.get("regime"), r.get("volatility"),
                        r.get("rel_strength"),
                    )
                    for r in rows
                ],
            )


def upsert_model_scores(rows):
    """rows: list of dicts with symbol, date, model_key, score"""
    if not rows:
        return
    with transaction() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO model_scores (symbol, date, model_key, score)
                VALUES %s
                ON CONFLICT (symbol, date, model_key) DO UPDATE SET
                  score = EXCLUDED.score
                """,
                [(r["symbol"], r["date"], r["model_key"], r["score"]) for r in rows],
            )


def upsert_final_signal(row):
    """row: dict with all final_signals columns"""
    with transaction() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO final_signals
                  (symbol, date, final_score, signal, regime,
                   weight_technical, weight_volatility, weight_rel_strength, confirmed)
                VALUES
                  (%(symbol)s, %(date)s, %(final_score)s, %(signal)s, %(regime)s,
                   %(weight_technical)s, %(weight_volatility)s, %(weight_rel_strength)s,
                   %(confirmed)s)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  final_score         = EXCLUDED.final_score,
                  signal              = EXCLUDED.signal,
                  regime              = EXCLUDED.regime,
                  weight_technical    = EXCLUDED.weight_technical,
                  weight_volatility   = EXCLUDED.weight_volatility,
                  weight_rel_strength = EXCLUDED.weight_rel_strength,
                  confirmed           = EXCLUDED.confirmed
                """,
                row,
            )


def upsert_model_performance(symbol, model_key, hit_rate_pct, sample_size):
    with transaction() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO model_performance (symbol, model_key, hit_rate_pct, sample_size, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (symbol, model_key) DO UPDATE SET
                  hit_rate_pct = EXCLUDED.hit_rate_pct,
                  sample_size  = EXCLUDED.sample_size,
                  updated_at   = NOW()
                """,
                (symbol, model_key, hit_rate_pct, sample_size),
            )


def start_pipeline_run():
    with transaction() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pipeline_runs (status) VALUES ('running') RETURNING id",
            )
            return cur.fetchone()[0]


def finish_pipeline_run(run_id, status, details=None):
    with transaction() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pipeline_runs
                SET status = %s, finished_at = NOW(), details = %s::jsonb
                WHERE id = %s
                """,
                (status, psycopg2.extras.Json(details or {}), run_id),
            )


def fetch_recent_prices(symbol, days=252):
    conn = get_connection()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT date, open, high, low, close, volume
            FROM prices
            WHERE symbol = %s
            ORDER BY date ASC
            LIMIT %s
            """,
            (symbol, days),
        )
        return cur.fetchall()


def fetch_recent_signals(symbol, days=60):
    conn = get_connection()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT date, signal
            FROM final_signals
            WHERE symbol = %s
            ORDER BY date DESC
            LIMIT %s
            """,
            (symbol, days),
        )
        return cur.fetchall()
