-- Model bazlı gerçek getiri metrikleri (sadece yön isabetine ek olarak)
ALTER TABLE model_performance ADD COLUMN IF NOT EXISTS avg_return_pct NUMERIC;
ALTER TABLE model_performance ADD COLUMN IF NOT EXISTS trade_count INTEGER DEFAULT 0;
