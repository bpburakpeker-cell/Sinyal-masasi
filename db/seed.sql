-- Sinyal Masası — Seed Data
-- Çekirdek hisseler (pipeline tam analiz yapar)
INSERT INTO stocks (symbol, name, sector, is_core) VALUES
  ('BIMAS', 'BİM Birleşik Mağazalar A.Ş.',   'Perakende', TRUE),
  ('BINHO', '1000 Yatırımlar Holding A.Ş.', 'Holding',   TRUE),
  ('EBEBK', 'Ebebek Mağazacılık A.Ş.',       'Perakende', TRUE)
ON CONFLICT (symbol) DO UPDATE SET
  name     = EXCLUDED.name,
  sector   = EXCLUDED.sector,
  is_core  = EXCLUDED.is_core;

-- Emsal hisseler (göreli güç hesabı için)
INSERT INTO stocks (symbol, name, sector, is_core) VALUES
  ('MGROS', 'Migros Ticaret A.Ş.',      'Perakende', FALSE),
  ('SOKM',  'Şok Marketler Ticaret',    'Perakende', FALSE),
  ('DOHOL', 'Doğan Holding',            'Holding',   FALSE),
  ('ALARK', 'Alarko Holding',           'Holding',   FALSE)
ON CONFLICT (symbol) DO UPDATE SET
  name   = EXCLUDED.name,
  sector = EXCLUDED.sector;
