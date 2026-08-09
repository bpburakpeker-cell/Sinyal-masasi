-- Haber sentimenti + temel veri + piyasa bağlamı için features tablosuna
-- opsiyonel kolonlar. Geçmiş (backfill) satırları NULL kalır — bu veriler
-- geriye dönük mevcut değil, sadece bugünden itibaren birikir.
ALTER TABLE features ADD COLUMN IF NOT EXISTS news_sentiment NUMERIC;
ALTER TABLE features ADD COLUMN IF NOT EXISTS fundamental_pe NUMERIC;
ALTER TABLE features ADD COLUMN IF NOT EXISTS fundamental_growth NUMERIC;
ALTER TABLE features ADD COLUMN IF NOT EXISTS market_trend NUMERIC;
