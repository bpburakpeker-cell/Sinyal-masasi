# Sinyal Masası Uygulaması

Sinyal Masası, BIST hisseleri için teknik göstergeleri birleştirip **AL / BEKLE / SAT** sinyali üreten, haber sentimenti ve basit portföy takibi sunan bir React + Vercel uygulamasıdır.

## Ne yapar?

- Seçilen hisseler için fiyat geçmişini getirir (`/api/quote`).
- USD/TRY kurunu sunucu tarafında çeker (`/api/fx`).
- Hisse haberlerini toplayıp başlığa göre sentiment puanı üretir (`/api/news`).
- Teknik göstergeler hesaplar:
  - RSI (14)
  - MACD
  - SMA 20/50
  - Bollinger Bands
- Göstergeleri ağırlıklandırıp birleşik bir skor üretir ve sinyale dönüştürür:
  - **AL**
  - **BEKLE**
  - **SAT**
- Hedef fiyat alanları, lot/maliyet girişi ve kâr-zarar özeti sağlar.
- Geçmiş veriye göre basit bir strateji simülasyonu (backtest) yapar.

## Uygulama yapısı

- `src/App.jsx`: Ana arayüz, sinyal hesaplama, ekran bileşenleri.
- `api/quote.js`: Yahoo Finance fiyat geçmişi proxy fonksiyonu.
- `api/fx.js`: USD/TRY kuru için çok kaynaklı fonksiyon.
- `api/news.js`: RSS haber çekimi ve sentiment hesaplaması.

## Çalışma akışı (özet)

1. Kullanıcı hisse seçer.
2. Uygulama API uç noktalarından veri çeker.
3. Teknik göstergeler ve haber sentimenti hesaplanır.
4. Adaptif ağırlıklarla skor ve sinyal üretilir.
5. Kart ve detay ekranlarında sonuçlar gösterilir.

## Notlar

- Veriler tarayıcıdan değil, Vercel sunucu fonksiyonları üzerinden alındığı için CORS sorunları azaltılır.
- API key gerektirmeden çalışacak şekilde tasarlanmıştır.
- Yerel kullanıcı tercihleri (hisseler, hedefler, portföy) `localStorage` içinde tutulur.
