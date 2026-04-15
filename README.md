# EduCert Chain

Diplom, sertifikat va onlayn kurs natijalarini blockchain reyestrida yaratish va tekshirish uchun Web3.js loyihasi.

## Nimalar bor

- Talaba profilini hash va metadata CID orqali markazsiz saqlash.
- Diplom yoki sertifikatni blockchain reyestrga yozish.
- Credential ID orqali hujjat haqiqiyligini tekshirish.
- Onlayn kurs natijasini alohida blockchain yozuvi sifatida qayd etish.
- Talaba ma'lumotlarini ish beruvchi yoki boshqa universitetga muddatli ochish.
- Barcha diplom va sertifikatlarni yagona reyestrda ko'rish.
- Demo Ledger rejimi: deploy qilinmagan statik serverda ham ishlaydi.
- Real blockchain rejimi: `EduChainRegistry.sol` kontrakti deploy qilinganda MetaMask va Web3.js orqali ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda:

```text
http://127.0.0.1:5176
```

Demo Ledger rejimida MetaMask shart emas. Ma'lumotlar brauzer `localStorage` ichida saqlanadi.

## Lokal blockchain bilan ishlatish

1. Birinchi terminalda lokal blockchainni ishga tushiring:

```bash
npm run chain
```

2. Ikkinchi terminalda kontraktni compile va deploy qiling:

```bash
npm run deploy:local
```

3. MetaMask ichida Ganache RPC qo'shing:

```text
RPC URL: http://127.0.0.1:8545
Chain ID: 1337
Currency: ETH
```

4. Ganache terminalidagi private keylardan birini MetaMask'ga import qiling.

5. Frontendni ishga tushiring:

```bash
npm run dev
```

## Public testnet deploy

`.env.example` asosida qiymatlarni PowerShell'da bering:

```powershell
$env:RPC_URL="https://your-testnet-rpc.example"
$env:NETWORK_NAME="Sepolia"
$env:PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
npm run deploy:network
npm run build
```

`public/contracts.json` deploy manzilini saqlaydi. Private key hech qachon GitHub'ga qo'shilmasligi kerak.

## GitHub'ga yuklash

```bash
git init
git add .
git commit -m "Build EduCert Chain blockchain diploma system"
git branch -M main
git remote add origin https://github.com/USERNAME/diploma-blockchain-system.git
git push -u origin main
```

Repository Settings -> Pages bo'limida GitHub Actions tanlansa, `.github/workflows/deploy-pages.yml` avtomatik deploy qiladi.

## Free static deploy

GitHub Pages:

- Build workflow tayyor.
- Deploy folder: `dist`.
- Build command: `npm run build`.

Netlify:

- Build command: `npm run build`.
- Publish directory: `dist`.
- `netlify.toml` tayyor.

Vercel:

- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.

## Muhim fayllar

- `contracts/EduChainRegistry.sol` - smart contract.
- `scripts/compile.mjs` - ABI va artifact yaratadi.
- `scripts/deploy.mjs` - kontraktni RPC tarmoqqa deploy qiladi.
- `src/main.js` - Web3.js va Demo Ledger logikasi.
- `src/style.css` - responsive dashboard dizayni.
- `public/contracts.json` - deploy konfiguratsiyasi.

## Eslatma

Static serverlar frontendni bepul joylashtiradi. Real blockchain yozuvlari uchun kontrakt lokal Ganache, Sepolia yoki boshqa EVM tarmoqqa deploy qilingan bo'lishi kerak.
