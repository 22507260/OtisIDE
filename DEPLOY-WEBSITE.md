# OtisIDE indirme sitesi — deploy notları

Bu klasör hazır bir statik sitedir. Derleme adımı yoktur; olduğu gibi yayınlanır.

```
website/
├─ index.html                        sitenin tamamı (CSS içeride, harici bağımlılık yok)
├─ netlify.toml                      indirme başlıkları + önbellek ayarları
├─ assets/
│  ├─ favicon.ico
│  ├─ otis-mascot.png                hero görseli
│  └─ workspace-tr.png               uygulama ekran görüntüsü
└─ downloads/
   └─ OtisIDE-1.2.0-x64.exe          111 MB kurulum dosyası
```

## Yöntem 1 — Sürükle bırak (en kolay)

1. https://app.netlify.com/drop adresini aç (Netlify hesabına giriş yapmış ol).
2. **`website` klasörünün tamamını** sayfaya sürükle bırak.
3. Yükleme bitince `https://rastgele-isim.netlify.app` adresi verilir.
4. İstersen Netlify panelinden **Site configuration → Change site name** ile adı `otiside` gibi bir şeyle değiştir.

## Yöntem 2 — Netlify CLI

CLI kuruldu (`netlify-cli 27.1.2`), ama Git Bash'in PATH'inde görünmüyor. **PowerShell'de** çalıştır:

```powershell
cd "C:\Users\karab\OneDrive\Videolar\Masaüstü\OtisIDE-main"
netlify login
netlify deploy --dir=website --prod
```

İlk `deploy` komutunda "Create & configure a new project" seçeneğini seç, takım ve site adını gir.

Git Bash kullanmak istersen komutun tam yolunu vermelisin:

```bash
"/c/Users/karab/AppData/Local/Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node-v24.19.0-win-x64/netlify.cmd" login
```

## Dikkat: 111 MB'lık exe

Netlify tek dosya için **10 MB** öneriyor. Bu dosya çok daha büyük:

- Yükleme sırasında zaman aşımı veya hata alabilirsin.
- Ücretsiz planda 100 GB/ay bant genişliği ≈ **900 indirme**; aşarsan site yavaşlar veya ek ücret çıkar.

Sorun yaşarsan kalıcı çözüm: exe'yi **GitHub Releases**'e yükle (2 GB dosya limiti, bant genişliği bedava), sonra `index.html` içindeki iki indirme bağlantısını değiştir:

```html
<!-- şu an -->
<a class="btn btn-primary" href="downloads/OtisIDE-1.2.0-x64.exe" download>

<!-- releases'e taşıyınca -->
<a class="btn btn-primary" href="https://github.com/22507260/OtisIDE/releases/download/v1.2.0/OtisIDE-1.2.0-x64.exe">
```

ve `website/downloads/` klasörünü silip öyle deploy et.

## Yeni sürüm çıkarınca

Proje kökünde tek komut yeter:

```powershell
npm run website:build
```

exe'yi derler, `website/downloads/` içine kopyalar, sayfadaki sürüm numarasını, dosya boyutunu ve SHA-256 özetini günceller. Sonra siteyi yukarıdaki yöntemlerden biriyle yeniden deploy et.

## Dosya doğrulama

`OtisIDE-1.2.0-x64.exe` SHA-256:

```
5b65885d528729ddaf35b9f3dcda23ae56289c2442f0b21a93e251d7945684e8
```

Kontrol için: `Get-FileHash .\downloads\OtisIDE-1.2.0-x64.exe -Algorithm SHA256`

## Not: SmartScreen

Kurulum dosyası kod imzalama sertifikasıyla imzalı değil; indirenlerde "Bilinmeyen yayımcı" uyarısı çıkar. Sitedeki Kurulum bölümünde bunun nasıl geçileceği yazıyor.
