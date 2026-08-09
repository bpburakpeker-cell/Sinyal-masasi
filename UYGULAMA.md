# Sinyal Masası Uygulaması (Güncel Vercel Deploy)

Sinyal Masası, BIST hisseleri için teknik analiz + haber etkisini birleştirerek **AL / BEKLE / SAT** sinyali ve hedef fiyat üreten React + Vercel uygulamasıdır.

## Son deploy ile güncel özellikler

- BIST hisse listesi içinden arama yaparak hisse ekleme/çıkarma.
- Kart görünümünde anlık sinyal, fiyat, günlük değişim ve hedef özeti.
- Detay sayfasında sekmeler:
  - **Özet** (teknik metrikler ve hedefler)
  - **Haberler** (hisse + piyasa haber akışı)
  - **Simülasyon** (basit backtest çıktısı)
- Otomatik **AL / BEKLE / SAT** hedef motoru:
  - Bollinger, SMA20/50, RSI, MACD ve haber sentimentini birlikte kullanır.
  - Kullanıcı hedefleri manuel düzenleyebilir, isterse tekrar otomatik hedefe dönebilir.
- Portföy alanı:
  - Lot ve maliyet girişi
  - Güncel kâr/zarar hesaplaması
- Veri yenileme:
  - Fiyat/kur verisi: 10 saniyede bir
  - Haber verisi: 5 dakikada bir
  - Manuel yenile butonu

## Teknik bileşenler

- `src/App.jsx`
  - Ana dashboard, hisse yönetimi, sinyal hesaplama, hedef motoru, detay ekranı ve backtest.
- `api/quote.js`
  - Yahoo Finance fiyat geçmişi (`range=1y`, `interval=1d`), sunucu tarafı cache.
- `api/fx.js`
  - USD/TRY için çok kaynaklı fallback (Frankfurter + ER-API), sunucu tarafı cache.
- `api/news.js`
  - Yahoo RSS kaynaklarından hisse + piyasa haberleri, başlık bazlı sentiment ve birleşik haber skoru.

## Çalışma akışı

1. Kullanıcı hisseleri seçer.
2. Uygulama `/api/quote`, `/api/fx`, `/api/news` uç noktalarından verileri toplar.
3. Teknik göstergeler + haber sentimenti ile birleşik skor üretilir.
4. Skor **AL / BEKLE / SAT** sinyaline çevrilir.
5. Otomatik hedef motoru AL/BEKLE/SAT fiyat seviyelerini hesaplar.
6. Kullanıcı isterse hedefleri manuel override eder ve localStorage'da saklar.

## Notlar

- Tüm veri çağrıları Vercel serverless fonksiyonları üzerinden geçtiği için tarayıcı tarafında CORS etkisi azaltılır.
- API key gerektirmez.
- Kullanıcı verileri (`sm_stocks`, `sm_targets`, `sm_portfolio`) localStorage'da tutulur.
