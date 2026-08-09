# Sinyal Masası — Canlıya Alma Rehberi

Uygulamanın özellik özeti için: **`/UYGULAMA.md`**

## Son Vercel güncellemesi

- Vercel, GitHub'daki en güncel commit'i otomatik deploy eder.
- Son güncelleme kapsamında uygulamaya:
  - otomatik **AL / BEKLE / SAT** hedef fiyat motoru,
  - hisse + piyasa haberlerinden türetilen sentiment desteği,
  - otomatik hedefleri manuel ezme ve tekrar otomatiğe dönme akışı,
  - çok faktörlü şirket/piyasa analiz katmanı,
  - tahmin geçmişi, doğruluk oranı ve tahmin-gerçekleşen fiyat karşılaştırması eklendi.
- Özelliklerin detayları için: **`/UYGULAMA.md`**

Bu proje artık üç parçadan oluşur:
- `src/App.jsx` — arayüz (React)
- `api/user-state.js` — kullanıcı izleme listesi, hedefler, portföy ve tahmin geçmişini kalıcı backend üstünden saklar
- `api/quote.js`, `api/fx.js`, `api/news.js`, `api/company.js`, `api/market.js`, `api/cron-refresh.js` — veri toplama ve snapshot katmanı. Cron ile arka planda veri tazeler, istemciye hazır veri sunar.

## Gereken hesaplar (ikisi de ücretsiz, kredi kartı istemez)
1. **GitHub** hesabı → https://github.com/signup
2. **Vercel** hesabı → https://vercel.com/signup (GitHub ile giriş yapabilirsin, tek tık)

## Adımlar

### 1) Projeyi GitHub'a yükle
- GitHub'da yeni bir repository oluştur (örn. `sinyal-masasi`), **public** veya **private** fark etmez.
- Bu klasördeki tüm dosyaları o repository'ye yükle. En kolay yol: GitHub Desktop uygulamasını indir, "Add local repository" ile bu klasörü seç, "Publish" de.
  - Alternatif (terminal biliyorsan):
    ```
    cd sinyal-masasi
    git init
    git add .
    git commit -m "ilk yükleme"
    git branch -M main
    git remote add origin https://github.com/KULLANICI_ADIN/sinyal-masasi.git
    git push -u origin main
    ```

### 2) Vercel'de projeyi bağla
1. https://vercel.com adresine gir, GitHub ile giriş yap.
2. "Add New… → Project" tıkla.
3. Az önce yüklediğin `sinyal-masasi` repository'sini seç.
4. Vercel, `vite` projesini otomatik tanır. Ayar değiştirmene gerek yok — "Deploy" butonuna bas.
5. 1-2 dakika içinde `sinyal-masasi-xxxx.vercel.app` gibi geçici bir adres verecek. Uygulaman orada canlı olacak.

### 3) Ortam değişkenlerini ekle
Vercel projesinde **Settings → Environment Variables** bölümüne en az şunları gir:
- `DATABASE_URL` → kalıcı PostgreSQL bağlantı adresi
- `CRON_SECRET` → `/api/cron-refresh` çağrılarını korumak için gizli anahtar

### 4) Test et
Adresi aç, üç hissenin de veri çektiğini gör. Artık istemci tarafı sadece backend API'lerini kullanır; Yahoo Finance ve diğer sağlayıcılara erişim sunucu tarafında kalır.

## Yerelde (kendi bilgisayarında) çalıştırmak istersen
Node.js (18+) kurulu olmalı.
```
npm install
npm install -g vercel
vercel dev
```
`vercel dev` hem arayüzü hem `/api` fonksiyonlarını birlikte ayağa kaldırır (sadece `npm run dev` ile açarsan `/api` istekleri çalışmaz, çünkü o fonksiyonlar Vercel'in sunucu ortamında koşar).

## Backend mimarisi notları
- Kullanıcı verileri artık tarayıcı `localStorage` yerine `/api/user-state` + PostgreSQL üstünde tutulur. Eski `localStorage` verileri ilk açılışta backend'e taşınır.
- Vercel cron tanımı `vercel.json` içindedir:
  - `*/10 * * * *` → fiyat/kur snapshot
  - `*/30 * * * *` → haber snapshot
  - `0 */12 * * *` → şirket/fundamental snapshot
- Snapshot'lar veritabanında tutulur; canlı route'lar önce bu snapshot'ları döndürür, gerekirse sağlayıcıdan yeniler.

## Sonradan eklenebilecekler
- Kendi domain'ini bağlamak istersen: Vercel projesinde **Settings → Domains** kısmından domain'i ekleyip DNS ayarlarını yönlendirmen yeterli (domain'i nereden aldıysan oranın DNS panelinden).
- Yahoo Finance'in resmi olmayan endpoint'i nadiren yapısını değiştirebilir. Böyle bir durumda `api/_lib/providers.js` içindeki sağlayıcı URL'leri güncellenir; istersen daha garantili (ama ücretli/kayıt gerektiren) bir sağlayıcıya da geçebiliriz.
- İleri aşamada anonim kullanıcı kimliğini gerçek oturum açma (magic link / OAuth) ile değiştirebilirsin.
