# Sinyal Masası Uygulaması (Son Vercel Deploy ile Uyumlu)

Sinyal Masası, BIST hisseleri için teknik göstergeler, haber akışı ve portföy takibini tek ekranda birleştiren React + Vercel uygulamasıdır. Uygulama her hisse için **AL / BEKLE / SAT** sinyali, otomatik hedef seviyeleri ve portföy bazlı net performans takibi üretir. Bu istemci tarafı hesaplamaya ek olarak, GitHub Actions üzerinde her iş günü kapanışta çalışan ayrı bir **Python model pipeline'ı** (Trend & Momentum, Risk & Oynaklık, Göreli Güç modellerinin ensemble'ı) BIMAS/BINHO/EBEBK için sunucu tarafında üretilmiş sinyal ve model kartları sağlar.

## Güncel özellik özeti

### 1. Dashboard
- Varsayılan olarak `BIMAS`, `BINHO` ve `EBEBK` ile açılır.
- Hisse kartlarında:
  - anlık fiyat,
  - günlük yüzde değişim,
  - sinyal göstergesi,
  - sinyale göre hedef özeti,
  - mini fiyat grafiği yer alır.
- Üst bölümde kayan ticker şeridi ile hisseler ve `USD/TRY` birlikte gösterilir.
- Manuel **Yenile** butonu vardır.
- Son veri yenileme saati ekranda gösterilir.

### 2. Hisse yönetimi
- **Hisse Ekle** akışı ile BIST listesi içinde arama yapılabilir.
- Hisse kodu veya şirket adına göre filtreleme vardır.
- Listeden hisse kaldırılabilir.
- Hazır listede olmayan semboller de özel giriş olarak eklenebilir.

### 3. Detay ekranı
Her hisse için detay ekranı açılır ve beş sekme sunulur:

- **İndikatörler**
  - RSI (14)
  - MACD histogram
  - Hareketli ortalama trendi (20/50)
  - Bollinger band konumu
  - Hisse haber sentimenti
  - Piyasa haber sentimenti
  - Birleşik haber etkisi
  - Birleşik sinyal skoru
  - Adaptif ağırlık dağılımı
  - **Bu Sinyali Oluşturan Modeller** (backend pipeline verisi varsa): her model için ağırlık yüzdesi, açıklaması ve son 60 günlük isabet oranı; ayrıca güncel piyasa rejimi (trend yukarı/aşağı, yatay, yüksek oynaklık) rozeti gösterilir

- **Haberler**
  - Hisseye özel haber akışı
  - Genel piyasa/borsa haberleri
  - Her haber için sentiment puanı
  - Hisse ve piyasa için ayrı ortalama duygu özeti

- **Tahmin**
  - 5 günlük tahmin fiyatı ve beklenen yön
  - tahmin fiyatı / gerçekleşen fiyat karşılaştırması
  - yön isabeti ve fiyat yakınlığına dayalı doğruluk oranı
  - ay bazında detaylı tahmin performansı
  - yıl bazında doğruluk grafiği

- **Portföy**
  - lot/adet girişi
  - ortalama maliyet girişi
  - anlık kâr/zarar tutarı
  - anlık getiri yüzdesi
  - pozisyon toplam değeri

- **Simülasyon**
  - yaklaşık 1 yıllık veri üzerinden geriye dönük strateji simülasyonu
  - al-ve-tut karşılaştırması
  - kullanıcı tarafından değiştirilebilen başlangıç tutarı

### 4. Otomatik hedef motoru
- Uygulama her hisse için otomatik:
  - **AL**
  - **BEKLE (alt)**
  - **BEKLE (üst)**
  - **SAT**
  seviyeleri üretir.
- Kullanıcı bu seviyeleri manuel değiştirebilir.
- Manuel girilen hedefler temizlenirse sistem tekrar otomatik hedefe döner.
- Hedef kartlarında durumun **MANUEL** veya **OTOMATİK** olduğu gösterilir.

### 5. Çok faktörlü analiz katmanı
- Teknik analiz ve haber sentimentine ek olarak aşağıdaki proxy analizler hesaba katılır:
  - sektör analizi
  - rekabet pozisyonu
  - yönetim kalitesi
  - makro faktörler
  - temettü politikası
  - KAP / kurumsal olay etkisi
  - piyasa akışı / hacim baskısı
- Bu faktörler açıklanabilir alt skorlar halinde hisse detayında gösterilir.
- Tahmin motoru, kapanan tahmin kayıtlarından öğrenerek ağırlıkları zaman içinde adapte eder.

### 6. Portföy ve net hedef takibi
- Ayrı bir **Portföyüm** özeti bulunur.
- Portföyde kayıtlı hisseler için toplam pozisyon durumu listelenir.
- **Ana Para & Hedef Takibi (Net)** panelinde:
  - başlangıç ana para,
  - portföy değeri,
  - aylık hedef %,
  - aylık hedef TL,
  - yıllık hedef %,
  - yıllık hedef TL,
  - aylık net kesinti,
  - yıllık ek net kesinti
  girilebilir.
- Panel ayrıca şunları hesaplar:
  - ay başı ve yıl başı referans değer,
  - aylık/yıllık net gerçekleşen sonuç,
  - hedefe sapma,
  - hedefe ilerleme oranı,
  - kesinti etkisi,
  - ay sonuna kadar gerekli günlük net tutar,
  - son 12 aya kadar aylık net performans geçmişi.

### 7. Backend model pipeline (Trend / Risk / Göreli Güç)
- İstemci tarafındaki hesaplamalara ek olarak, sunucu tarafında günlük çalışan ayrı bir **Python pipeline** üç bağımsız model üretir:
  - **Trend & Momentum Modeli** (`technical`) — SMA/RSI/MACD/OBV tabanlı yön skoru
  - **Risk & Oynaklık Modeli** (`volatility`) — GARCH(1,1) ile oynaklık tahmini ve piyasa rejimi tespiti (`trend_up` / `trend_down` / `sideways` / `high_volatility`)
  - **Göreli Güç Modeli** (`relative_strength`) — hissenin sektör emsallerine (Perakende → MGROS, SOKM; Holding → DOHOL, ALARK) kıyasla 20 günlük rölatif performansı
- Üç model skoru, tespit edilen piyasa rejimine göre değişen ağırlıklarla **ensemble** edilerek nihai `final_score` ve `AL / BEKLE / SAT` sinyaline dönüştürülür.
- Sinyal, son 3 günün tutarlılığına bakan bir **onay filtresinden (confirmation filter)** geçtikten sonra `confirmed` olarak işaretlenir.
- Her modelin son 60 günlük isabet oranı ayrıca hesaplanıp saklanır ve detay ekranındaki “Bu Sinyali Oluşturan Modeller” kartlarında gösterilir.
- Şu an sadece **BIMAS, BINHO, EBEBK** için çalışır (`scripts/daily_pipeline.py` içindeki `CORE_STOCKS`).
- Bu katman opsiyoneldir: pipeline hiç çalışmamışsa veya veri yoksa uygulama istemci tarafı hesaplamaya (bkz. bölüm 3 “İndikatörler”) sorunsuz geri döner.
- Pipeline verisi 48 saatten eski ise dashboard'da “Model verileri … önce güncellendi, pipeline çalışmıyor olabilir” uyarı şeridi gösterilir.

## Veri kaynakları ve API uçları

- `api/user-state.js`
  - kullanıcı izleme listesi, portföy, hedefler ve tahmin geçmişini kalıcı backend üzerinde tutar.

- `api/quote.js`
  - Yahoo Finance fiyat geçmişini çeker.
  - `range=1y` ve `interval=1d` kullanır.
  - Önce veritabanındaki snapshot'ı okur, gerekiyorsa sağlayıcıdan yeniler.

- `api/fx.js`
  - `USD/TRY` kurunu birden fazla kaynaktan alır.
  - Kaynaklar:
    - Frankfurter
    - ER-API
  - Sonuç veritabanı snapshot'ı olarak saklanır.

- `api/news.js`
  - Yahoo Finance RSS kaynaklarından haber toplar.
  - Hisse ve piyasa haberlerini ayrı işler.
  - Başlıklardan basit sentiment skoru üretir.
  - Haber snapshot'larını cron ile önceden doldurur.

- `api/company.js`
  - Yahoo şirket özeti/fundamental verilerinden sektör, temettü, büyüme, borç ve hedef fiyat proxy alanlarını çeker.
  - Fundamental snapshot'ları uzun TTL ile tutulur.

- `api/market.js`
  - `^XU100` ve `TRY=X` üzerinden piyasa/makro proxy verilerini üretir.

- `api/cron-refresh.js`
  - fiyat/kur, haber ve şirket snapshot'larını zamanlanmış iş olarak yeniler.

- `api/system-status.js`
  - snapshot tazeliği, job sağlık durumu ve PostgreSQL bağlantı/şema hazırlığını raporlar.

- `api/signal.js`
  - `GET /api/signal?symbol=BIMAS`
  - Backend pipeline'ın `final_signals` tablosundaki en güncel sinyalini, model ağırlıklarını ve her modelin isabet oranını döner.
  - Pipeline hiç çalışmadıysa veya DB yoksa `404`/`503` döner; istemci bu durumda kendi hesapladığı sinyale geri düşer.

- `api/history.js`
  - `GET /api/history?symbol=BIMAS&days=90`
  - `prices` tablosundan (pipeline tarafından doldurulur) geçmiş kapanış verisini döner; Yahoo'ya tekrar gitmez.

## Yenileme sıklığı

- Backend cron yenilemesi (Vercel, `vercel.json`):
  - fiyat ve kur snapshot'ı: **10 dakikada bir**
  - haber snapshot'ı: **30 dakikada bir**
  - şirket/fundamental snapshot'ı: **12 saatte bir**
- Model pipeline yenilemesi (GitHub Actions, `.github/workflows/daily-pipeline.yml`):
  - **Pazartesi–Cuma, BIST kapanışında (18:00 TRT / 15:00 UTC)** otomatik çalışır
  - Actions sekmesinden **elle de (`workflow_dispatch`)** tetiklenebilir
- İstemci görünümü:
  - snapshot görünümü: **1 dakikada bir**
  - haber görünümü: **15 dakikada bir**
  - kullanıcı isterse manuel yenileme yapabilir.

## Kalıcılık

Kullanıcı tercihleri artık kalıcı backend + PostgreSQL üstünde saklanır.

- İlk açılışta eski `localStorage` verileri backend'e taşınır.
- Tarayıcıda yalnızca anonim kullanıcı kimliği için `sm_user_id` tutulur.
- Kalıcı alanlar: izlenen hisseler, hedefler, portföy, net hedef ayarları, performans snapshot'ları, aylık geçmiş ve tahmin ledger kayıtları.

## PostgreSQL altyapısı

- Uygulama PostgreSQL ile çalışacak şekilde hazırdır ve backend bunu aktif olarak kullanır.
- Yönetilen sağlayıcı olarak pratik seçenekler:
  - **Neon**
  - **Supabase Postgres**
  - **Vercel Postgres**
- Bağlantı `DATABASE_URL` ortam değişkeni üzerinden yapılır.
- Varsayılan SSL davranışı yönetilen servislerle uyumlu olacak şekilde açıktır.
- İsteğe bağlı bağlantı ayarları:
  - `PGSSLMODE`
  - `PG_MAX_CONNECTIONS`
  - `PG_IDLE_TIMEOUT_MS`
  - `PG_CONNECT_TIMEOUT_MS`

### Otomatik oluşturulan ana tablolar (web uygulaması)

- `users`
- `user_states`
- `market_snapshots`
- `job_runs`

### Pipeline tabloları (`db/migrations/001_init.sql`)

Model pipeline'ı için ayrı, elle uygulanan bir migration seti kullanılır (mevcut `market_snapshots` / `job_runs` tablolarına dokunmaz):

- `stocks` — hisse listesi (sembol, ad, sektör, çekirdek hisse mi)
- `prices` — günlük OHLCV fiyatları
- `features` — hesaplanmış teknik özellikler (SMA/RSI/MACD/Bollinger/OBV/rejim/oynaklık/göreli güç) + bağlam verisi (`news_sentiment`, `fundamental_pe`, `fundamental_growth`, `market_trend` — `db/migrations/003_context_features.sql`, bkz. not aşağıda)
- `model_scores` — model bazlı ham skorlar (`technical` / `volatility` / `relative_strength`)
- `final_signals` — ensemble sonucu final skor, sinyal, rejim, ağırlıklar, onay durumu
- `model_performance` — model başına son 60 günlük isabet oranı
- `pipeline_runs` — pipeline çalışma logu (başlangıç/bitiş, durum, detaylar)
- `weights_history` — geçmiş ağırlık kayıtları

### Mevcut DB kullanım modeli

- **Kullanıcı tercihleri ve portföy** → `user_states.state` içinde JSONB
- **Cache / snapshot verileri** → `market_snapshots`
- **Arka plan cron logları (Vercel)** → `job_runs`
- **Model pipeline verisi ve logu (GitHub Actions)** → `final_signals`, `model_scores`, `features`, `pipeline_runs` vb.

### Bağlam verisi toplama notu (news_sentiment / fundamental_pe / fundamental_growth / market_trend)

- Bu 4 alan, Madde 5 (öğrenilmiş meta-model) için ileride kullanılmak üzere `daily_pipeline.py` tarafından her gün toplanır (`scripts/lib/fetch_news.py`, `fetch_company.py`, `fetch_market.py`). **Mevcut sinyal mantığını hiç etkilemez** — sadece veri biriktirir.
- `scripts/backfill.py` bu alanları geriye dönük doldurmaz (haber/temel veri geçmişi mevcut değil); geçmiş satırlar kalıcı olarak NULL kalır. `upsert_features` bu 4 alan için `COALESCE(EXCLUDED.x, features.x)` kullanır, yani backfill'in periyodik yeniden hesaplaması pipeline'ın yazdığı güncel değerleri asla ezmez.
- `fundamental_pe` / `fundamental_growth` şu an **pratikte hep NULL** kalıyor: Yahoo Finance, `quoteSummary`/`quote` endpoint'lerine artık sunucu-taraflı isteklerde crumb/oturum çerezi zorunlu kılıyor ve bu çerez basit bir `requests` isteğiyle hiç set edilmiyor (401 Unauthorized). `news_sentiment` (RSS tabanlı) ve `market_trend` (chart endpoint tabanlı, `XU100.IS` sembolü — `^XU100` boş veri dönüyor) sorunsuz çalışıyor. `fetch_company.py` try/except ile zarifçe None dönüyor; pipeline etkilenmiyor.

### DB adresi notu

- Güvenlik nedeniyle gerçek PostgreSQL bağlantı adresi (`DATABASE_URL`) repo içindeki markdown dosyalarına düz metin olarak yazılmadı.
- Aynı Neon bağlantı adresi iki yerde tanımlıdır:
  - Vercel → **Project Settings → Environment Variables → `DATABASE_URL`** (web uygulaması / API route'ları için)
  - GitHub → **repo Settings → Secrets and variables → Actions → `DATABASE_URL`** (günlük model pipeline'ının `daily-pipeline.yml` workflow'u için; ayarlandı ve doğrulandı)
- Yerelde geliştirirken: `.env.local` (varsa) veya örnek format için `.env.example`.
- Bu sayede bağlantı bilgisi repoya commit edilmeden korunur.

## Doğrulama ve izleme

- `/api/system-status`
  - DB bağlı mı?
  - şema hazır mı?
  - hangi tablolar mevcut?
  - son snapshot ve job kayıtları neler?
- `/api/user-state?userId=test-user`
  - kullanıcı state okuma/yazma kontrolü için kullanılabilir.
- `/api/cron-refresh?job=fast&secret=...`
  - fiyat/kur snapshot üretimi ve `job_runs` kaydı doğrulanabilir.
- GitHub Actions → **Actions → Sinyal Masası — Günlük Pipeline**
  - koşum geçmişi, loglar ve elle tetikleme (`Run workflow`) buradan yapılır.
  - başarılı bir koşumda `pipeline_runs` tablosuna `status: success` kaydı düşer; bunu `/api/signal?symbol=BIMAS` ile de doğrulayabilirsin.
- `/api/signal?symbol=BIMAS`
  - pipeline'ın ürettiği güncel sinyal, model ağırlıkları ve isabet oranlarını doğrulamak için kullanılabilir.

## Teknik notlar

- Uygulama Vercel serverless fonksiyonları + PostgreSQL snapshot katmanı üzerinden veri çektiği için tarayıcı tarafındaki CORS sorunları azaltılır.
- Herhangi bir API key gerektirmez.
- Veri alınamazsa bazı hisseler için **örnek veri** ile kartı doldurma akışı vardır.
- Model pipeline'ı GitHub Actions üzerinde, uygulamanın geri kalanından bağımsız çalışır; Actions/`checkout`/`setup-python` action'ları `v7` sürümünde tutulur (Node.js 20 deprecation uyarısını önlemek için).
- Uygulama yatırım tavsiyesi vermez; sinyaller otomatik yorum ve skorlamaya dayanır.
