# Sinyal Masası Uygulaması

Sinyal Masası, BIST hisseleri için teknik göstergeleri birleştirip **AL / BEKLE / SAT** sinyali üreten, haber sentimenti ve basit portföy takibi sunan bir React + Vercel uygulamasıdır.

## Ne yapar?

- Seçilen hisseler için fiyat geçmişini getirir (`/api/quote`).
- USD/TRY kurunu sunucu tarafında çeker (`/api/fx`).
- Hisse haberlerini ve genel borsa haberlerini toplayıp başlığa göre sentiment puanı üretir (`/api/news`).
- Teknik göstergeler hesaplar:
  - RSI (14)
  - MACD
  - SMA 20/50
  - Bollinger Bands
- Göstergeleri ağırlıklandırıp birleşik bir skor üretir ve sinyale dönüştürür:
  - **AL**
  - **BEKLE**
  - **SAT**
- Teknik destek/direnç, Bollinger, SMA ve haber akışına göre otomatik **AL / BEKLE / SAT** hedefleri önerir.
- Otomatik hedefleri kullanıcı bazında manuel olarak ezmeye ve tekrar otomatik değere dönmeye izin verir.
- Lot/maliyet girişi ve kâr-zarar özeti sağlar.
- Geçmiş veriye göre basit bir strateji simülasyonu (backtest) yapar.

## Uygulama yapısı

- `src/App.jsx`: Ana arayüz, sinyal hesaplama, otomatik hedef fiyat motoru ve ekran bileşenleri.
- `api/quote.js`: Yahoo Finance fiyat geçmişi proxy fonksiyonu.
- `api/fx.js`: USD/TRY kuru için çok kaynaklı fonksiyon.
- `api/news.js`: Hisse ve piyasa RSS haberlerini çekip sentiment hesaplaması yapar.

## Çalışma akışı (özet)

1. Kullanıcı hisse seçer.
2. Uygulama API uç noktalarından veri çeker.
3. Teknik göstergeler ile hisse + piyasa haber sentimenti hesaplanır.
4. Adaptif ağırlıklarla skor ve sinyal üretilir.
5. Ayrı bir hedef motoru otomatik AL / BEKLE / SAT fiyat bantlarını oluşturur.
6. Kart ve detay ekranlarında otomatik ve manuel hedefler birlikte gösterilir.

## Notlar

- Veriler tarayıcıdan değil, Vercel sunucu fonksiyonları üzerinden alındığı için CORS sorunları azaltılır.
- API key gerektirmeden çalışacak şekilde tasarlanmıştır.
- Yerel kullanıcı tercihleri (hisseler, manuel hedef ezmeleri, portföy) `localStorage` içinde tutulur.
