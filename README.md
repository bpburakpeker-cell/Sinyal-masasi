# Sinyal Masası — Canlıya Alma Rehberi

Uygulamanın özellik özeti için: **`/UYGULAMA.md`**

Bu proje iki parçadan oluşur:
- `src/App.jsx` — arayüz (React)
- `api/quote.js`, `api/fx.js` — Vercel'de otomatik çalışan küçük sunucu fonksiyonları. Bunlar Yahoo Finance ve döviz kurunu **sunucu tarafında** çeker, bu yüzden tarayıcıda CORS hatası almazsın. Herhangi bir API key gerekmez.

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

### 3) Test et
Adresi aç, üç hissenin de veri çektiğini gör. Artık CORS/proxy sorunu olmamalı çünkü Yahoo Finance isteği artık senin kendi sunucu fonksiyonun (`/api/quote`) üzerinden, sunucudan sunucuya gidiyor.

## Yerelde (kendi bilgisayarında) çalıştırmak istersen
Node.js (18+) kurulu olmalı.
```
npm install
npm install -g vercel
vercel dev
```
`vercel dev` hem arayüzü hem `/api` fonksiyonlarını birlikte ayağa kaldırır (sadece `npm run dev` ile açarsan `/api` istekleri çalışmaz, çünkü o fonksiyonlar Vercel'in sunucu ortamında koşar).

## Sonradan eklenebilecekler
- Kendi domain'ini bağlamak istersen: Vercel projesinde **Settings → Domains** kısmından domain'i ekleyip DNS ayarlarını yönlendirmen yeterli (domain'i nereden aldıysan oranın DNS panelinden).
- Yahoo Finance'in resmi olmayan endpoint'i nadiren yapısını değiştirebilir. Böyle bir durumda `api/quote.js` içindeki URL güncellenir; istersen daha garantili (ama ücretli/kayıt gerektiren) bir sağlayıcıya da geçebiliriz.
- Otomatik yenileme şu an tarayıcı açıkken 5 dakikada bir çalışıyor; sunucu tarafında zamanlanmış görev (cron) ile arka planda veri toplamak istersen Vercel Cron Jobs eklenebilir.
