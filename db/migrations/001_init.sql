-- Sinyal Masası — Pipeline DB Şeması
-- Mevcut market_snapshots / job_runs tablolarına DOKUNMAZ
-- Yeni pipeline'a özgü tablolar

-- 1) Hisse listesi
CREATE TABLE IF NOT EXISTS stocks (
  symbol      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sector      TEXT,
  is_core     BOOLEAN DEFAULT FALSE,   -- BIMAS/BINHO/EBEBK
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Günlük OHLCV fiyatları
CREATE TABLE IF NOT EXISTS prices (
  symbol  TEXT        NOT NULL,
  date    DATE        NOT NULL,
  open    NUMERIC,
  high    NUMERIC,
  low     NUMERIC,
  close   NUMERIC     NOT NULL,
  volume  BIGINT,
  PRIMARY KEY (symbol, date)
);
CREATE INDEX IF NOT EXISTS prices_symbol_date ON prices (symbol, date DESC);

-- 3) Hesaplanmış teknik özellikler
CREATE TABLE IF NOT EXISTS features (
  symbol        TEXT    NOT NULL,
  date          DATE    NOT NULL,
  sma20         NUMERIC,
  sma50         NUMERIC,
  rsi           NUMERIC,
  macd_hist     NUMERIC,
  bollinger_pos NUMERIC,   -- 0-1 arası bant içi konum
  obv           NUMERIC,
  obv_signal    NUMERIC,   -- OBV'nin EMA'sı
  regime        TEXT,      -- trend_up | trend_down | sideways | high_volatility
  volatility    NUMERIC,   -- GARCH(1,1) günlük volatilite tahmini
  rel_strength  NUMERIC,   -- sektör ortalamasına göre rölatif güç (-100..100)
  PRIMARY KEY (symbol, date)
);

-- 4) Model bazlı ham skorlar
CREATE TABLE IF NOT EXISTS model_scores (
  symbol     TEXT    NOT NULL,
  date       DATE    NOT NULL,
  model_key  TEXT    NOT NULL,   -- technical | volatility | relative_strength
  score      NUMERIC NOT NULL,   -- -100..100
  PRIMARY KEY (symbol, date, model_key)
);

-- 5) Final sinyal (ensemble çıktısı)
CREATE TABLE IF NOT EXISTS final_signals (
  symbol              TEXT    NOT NULL,
  date                DATE    NOT NULL,
  final_score         NUMERIC NOT NULL,
  signal              TEXT    NOT NULL,   -- AL | BEKLE | SAT
  regime              TEXT,
  weight_technical    NUMERIC,
  weight_volatility   NUMERIC,
  weight_rel_strength NUMERIC,
  confirmed           BOOLEAN DEFAULT FALSE,  -- 3-gün tutarlılık filtresi
  PRIMARY KEY (symbol, date)
);
CREATE INDEX IF NOT EXISTS final_signals_symbol_date ON final_signals (symbol, date DESC);

-- 6) Model performans takibi (son 60 gün isabet %)
CREATE TABLE IF NOT EXISTS model_performance (
  symbol       TEXT    NOT NULL,
  model_key    TEXT    NOT NULL,
  hit_rate_pct NUMERIC,        -- NULL = yeterli veri yok
  sample_size  INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, model_key)
);

-- 7) Pipeline çalışma log'u
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id          SERIAL PRIMARY KEY,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status      TEXT DEFAULT 'running',  -- running | success | error
  details     JSONB DEFAULT '{}'::jsonb
);

-- 8) Ağırlık geçmişi
CREATE TABLE IF NOT EXISTS weights_history (
  symbol              TEXT    NOT NULL,
  date                DATE    NOT NULL,
  regime              TEXT,
  weight_technical    NUMERIC,
  weight_volatility   NUMERIC,
  weight_rel_strength NUMERIC,
  PRIMARY KEY (symbol, date)
);
