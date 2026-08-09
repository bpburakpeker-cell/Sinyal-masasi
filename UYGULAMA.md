# Sinyal Masası Uygulaması (Son Vercel Deploy ile Uyumlu)

Sinyal Masası, BIST hisseleri için teknik göstergeler, haber akışı ve portföy takibini tek ekranda birleştiren React + Vercel uygulamasıdır. Uygulama her hisse için **AL / BEKLE / SAT** sinyali, otomatik hedef seviyeleri ve portföy bazlı net performans takibi üretir.

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
Her hisse için detay ekranı açılır ve dört sekme sunulur:

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
  - snapshot tazeliği ve job sağlık durumunu raporlar.

## Yenileme sıklığı

- Backend cron yenilemesi:
  - fiyat ve kur snapshot'ı: **10 dakikada bir**
  - haber snapshot'ı: **30 dakikada bir**
  - şirket/fundamental snapshot'ı: **12 saatte bir**
- İstemci görünümü:
  - snapshot görünümü: **1 dakikada bir**
  - haber görünümü: **15 dakikada bir**
  - kullanıcı isterse manuel yenileme yapabilir.

## Kalıcılık

Kullanıcı tercihleri artık kalıcı backend + PostgreSQL üstünde saklanır.

- İlk açılışta eski `localStorage` verileri backend'e taşınır.
- Tarayıcıda yalnızca anonim kullanıcı kimliği için `sm_user_id` tutulur.
- Kalıcı alanlar: izlenen hisseler, hedefler, portföy, net hedef ayarları, performans snapshot'ları, aylık geçmiş ve tahmin ledger kayıtları.

## Teknik notlar

- Uygulama Vercel serverless fonksiyonları + PostgreSQL snapshot katmanı üzerinden veri çektiği için tarayıcı tarafındaki CORS sorunları azaltılır.
- Herhangi bir API key gerektirmez.
- Veri alınamazsa bazı hisseler için **örnek veri** ile kartı doldurma akışı vardır.
- Uygulama yatırım tavsiyesi vermez; sinyaller otomatik yorum ve skorlamaya dayanır.
