# Otomatik güncelleme ve sürüm çıkarma

OtisIDE artık açılışta GitHub Releases'i kontrol eder ve yeni sürüm varsa kullanıcıya sorar.

## Kullanıcı ne görüyor?

1. Uygulama açılır, 4 saniye sonra sessizce GitHub'a sorar; pencere açık kaldığı
   sürece altı saatte bir tekrar bakar.
2. Yeni sürüm yoksa **hiçbir şey görünmez**. İnternet yoksa veya depo erişilemezse de sessiz kalır.
3. Yeni sürüm varsa ekranın ortasında pencere çıkar:
   *"OtisIDE'nin yeni sürümü hazır — Yüklü: 1.3.0 · Yeni: 1.3.1"*, release notlarıyla birlikte.
   - **Şimdi güncelle** → indirme başlar, ilerleme çubuğu görünür
   - **Daha sonra** → pencere kapanır, o sürüm için bir daha sorulmaz (uygulama yeniden açılana kadar)
4. İndirme bitince: **Yeniden başlat ve kur** veya **Bir sonraki açılışta kur**.
5. "Yeniden başlat ve kur" derse uygulama kapanır, kurulum çalışır ve yeni sürümle geri açılır.

Kullanıcı hiçbir şey yapmasa bile güncelleme bir sonraki çıkışta kurulur
(`autoInstallOnAppQuit`).

## Yeni sürüm çıkarmak

### Ön koşullar (bir kez)

- `https://github.com/22507260/OtisIDE` deposu **herkese açık** olmalı. Depo özel olursa
  güncelleme kontrolü 404 alır ve sessizce başarısız olur.
- Yayınlanan release **taslak (draft) veya ön sürüm (prerelease) olmamalı**.

### Yol 1 — Etiket at, gerisini GitHub yapsın (önerilen)

```powershell
npm version 1.6.2 --no-git-tag-version
git add -A
git commit -m "release: 1.6.2"
git tag v1.6.2
git push origin main
git push origin main:master
git push origin v1.6.2
```

`v*` etiketi `.github/workflows/release.yml` iş akışını tetikler. İş akışı Windows
sunucusunda testleri çalıştırır, etiketle `package.json` sürümünün aynı olduğunu doğrular,
kurulum dosyasını derler ve **üç dosyayı** release'e yükler:

| Dosya | Ne işe yarar |
| --- | --- |
| `OtisIDE-1.6.2-x64.exe` | Kurulum dosyası |
| `latest.yml` | **Güncelleme kontrolü bunu okur — olmazsa güncelleme çalışmaz** |
| `OtisIDE-1.6.2-x64.exe.blockmap` | Fark indirmesi (sadece değişen kısmı indirir, hızlandırır) |

Son adımda iş akışı üç dosyanın da yüklendiğini kendisi kontrol eder; eksik varsa kırmızı
yanar. 111 MB'lik yükleme senin bağlantından gitmediği için yarıda kopma sorunu da kalmaz.

**Release açıklamasını iş akışı yazmaz.** electron-builder release'i boş açıklamayla ve
sadece `1.7.0` adıyla oluşturur; açıklamayı sonradan sen eklemelisin — GitHub arayüzünden
ya da API ile:

```powershell
$id = (Invoke-RestMethod -Headers @{Authorization="Bearer $env:GH_TOKEN"} `
  "https://api.github.com/repos/22507260/OtisIDE/releases/tags/v1.7.0").id
$body = @{ name = "OtisIDE 1.7.0"; body = (Get-Content notes.md -Raw) } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Headers @{Authorization="Bearer $env:GH_TOKEN"} `
  -ContentType "application/json" -Body $body `
  "https://api.github.com/repos/22507260/OtisIDE/releases/$id"
```

Bu metin kullanıcılara güncelleme penceresinde "Yenilikler" olarak görünür. Eski bir
sürümden atlayan kullanıcı aradaki bütün release açıklamalarını birden gördüğü için
(`fullChangelog`), boş bırakılan bir sürüm o listede boşluk olarak kalır.

### Yol 2 — Elle yükleme (yedek yöntem)

CI çalışmıyorsa ya da acil bir durum varsa:

```powershell
npm version 1.6.2 --no-git-tag-version
npm run electron:build
```

Sonra GitHub'da **Releases → Draft a new release**:

- Tag: `v1.6.2` (başında `v` olsun)
- `release\` klasöründen şu üç dosyayı sürükle: `OtisIDE-1.6.2-x64.exe`,
  `latest.yml`, `OtisIDE-1.6.2-x64.exe.blockmap`
- **Publish release** (draft olarak bırakma)

Elle yüklediğinde üç dosyanın da gerçekten yüklendiğini **kendin doğrula**; bir kez exe
yüklemesi yarıda koptu ve release'de yalnızca `latest.yml` kaldı — o hâlde bütün
istemcilerde güncelleme 404 alır.

`npm run release` komutunu yerelde çalıştıracaksan `GH_TOKEN` ortam değişkeni gerekir;
CI'da bu değişken otomatik sağlanır.

### İndirme sitesini de güncellemek

```powershell
npm run website:prepare
git add website/index.html
git commit -m "site: point the download at 1.7.0"
git push origin main
git push origin main:master
```

Komut sayfadaki sürümü, indirme bağlantısını, dosya boyutunu ve SHA-256 değerini tazeler.
Yerelde derlenmiş bir kurulum dosyası varsa onu ölçer; yoksa release'e yüklenmiş dosyayı
indirmeden ölçer — yani etiketi attıktan ve iş akışı bittikten sonra çalıştır.

**Netlify `master` dalından yayın yapıyor**, bu yüzden iki dala da push etmek gerekiyor;
yalnızca `main` pushlanırsa site hiçbir hata vermeden eski sürümde kalır.

## Önemli: 1.2.0 kullanıcıları güncellenmez

Otomatik güncelleme kodu 1.3.0 ile geldi. Daha önce 1.2.0 kuran birinde güncelleme
kontrolü yapan kod yok, dolayısıyla o kurulumlar kendiliğinden güncellenmez —
sitedeki kurulum dosyasının 1.3.0 (veya üstü) olması bu yüzden önemli.

## Paketleme: arayüz kütüphaneleri `devDependencies` içinde durur

Vite; React, Konva, Monaco ve OpenAI istemcisini `dist` içine paketliyor. Bu paketler
`dependencies` altında dururken electron-builder aynı kütüphanelerin ham hâllerini
kuruluma bir kez daha koyuyordu — tek başına Monaco 74 MB'ydi. `electron/*.js` dosyasının
gerçekten `require` ettiği iki paket dışında (`serialport`, `electron-updater`) hiçbir şey
`dependencies` altına alınmamalı. `npm install --save <arayüz-kütüphanesi>` bunu sessizce
bozar ve kurulum dosyası yeniden şişer.

## Sürüm numarası kuralı

`package.json` içindeki `version` alanı, karşılaştırmanın tek kaynağıdır. Yeni sürüm
numarası eskisinden **büyük** olmalı (semver). Aynı numarayla ikinci bir release
yayınlarsan hiçbir istemci güncelleme görmez.

## Yerel test (GitHub'a dokunmadan)

`OTISIDE_UPDATE_FEED_URL` ayarlıysa updater GitHub yerine verdiğin adrese bakar:

```powershell
# 1. "Yeni" sürümü derle, çıktıları bir klasöre koy
npm version 1.3.1 --no-git-tag-version
npm run electron:build
mkdir C:\temp\feed
copy release\OtisIDE-1.3.1-x64.exe C:\temp\feed
copy release\latest.yml C:\temp\feed
copy release\OtisIDE-1.3.1-x64.exe.blockmap C:\temp\feed

# 2. Eski sürüme dön ve onu derle
npm version 1.3.0 --no-git-tag-version
npm run electron:build

# 3. Feed klasörünü sun
npx --yes http-server C:\temp\feed -p 8099

# 4. Eski sürümü feed adresiyle çalıştır
$env:OTISIDE_UPDATE_FEED_URL = "http://127.0.0.1:8099"
.\release\win-unpacked\OtisIDE.exe
```

Aynı değişken, güncellemeleri GitHub yerine kendi sunucundan dağıtmak istersen de
kullanılabilir.

## Seçenek: sessiz indirme (tam Discord davranışı)

Varsayılan akış önce sorar, sonra indirir. `OTISIDE_UPDATE_AUTO_DOWNLOAD=1` ortam
değişkeni ayarlıysa güncelleme arka planda kendiliğinden iner ve kullanıcıya yalnızca
"kuruluma hazır, yeniden başlatayım mı?" diye sorulur. Kalıcı yapmak istersen
`electron/updater.js` içindeki `autoUpdater.autoDownload` satırını `true` yap.

## Bilinen sınır: imzasız kurulum

Kurulum dosyası kod imzalama sertifikasıyla imzalı olmadığı için Windows SmartScreen
"Bilinmeyen yayımcı" uyarısı gösterebilir. Güncelleme akışı yine çalışır; uyarı
yalnızca kurulum adımında çıkar. Kalıcı çözüm ücretli bir sertifika almaktır.

## Sorun giderme: güncelleme günlüğü

Güncelleme akışı kullanıcıyı rahatsız etmemek için sessiz çalışır; ayrıntılar şu dosyaya yazılır:

```
%APPDATA%\otiside\updater.log
```

Güncelleme gelmiyorsa önce buraya bak. Sık görülen satırlar:

| Günlük satırı | Anlamı |
| --- | --- |
| `Update for version X is not available` | Yayındaki release, çalışan sürümden yeni değil |
| `404` / `Cannot find latest.yml` | Release yok, taslak durumda ya da `latest.yml` yüklenmemiş |
| `net::ERR_INTERNET_DISCONNECTED` | Bağlantı yok; bir sonraki açılışta yeniden denenir |

## İlgili dosyalar

| Dosya | Görevi |
| --- | --- |
| `electron/updater.js` | Kontrol, indirme, kurulum ve durum yayını |
| `electron/main.js` | Açılışta `startUpdateCheck()` çağrısı |
| `electron/preload.js` | Renderer'a açılan güncelleme API'si |
| `src/components/UpdateNotice.tsx` | Kullanıcıya görünen pencere |
| `package.json` → `build.publish` | GitHub depo bilgisi |
