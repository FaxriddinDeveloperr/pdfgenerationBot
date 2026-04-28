# 🤖 Printvoltrabot

> Professional ERP Zayafka Telegram Bot — nakladnoy va kafolat PDF generator

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://typescriptlang.org)
[![grammY](https://img.shields.io/badge/Bot%20Framework-grammY-orange.svg)](https://grammy.dev)
[![Docker](https://img.shields.io/badge/Deploy-Docker-blue.svg)](https://docker.com)

---

## 📌 Nima qiladi?

**Printvoltrabot** — bu ERP tizimidan Telegram guruhga kelgan sotuv (zayafka) xabarlarini avtomatik aniqlaydi va professional PDF hujjatlar yaratib beradi.

### Ish jarayoni:
```
ERP → Guruhga zayafka xabari
         ↓
Bot avtomatik tugmalar qo'shadi
  [📄 Nakladnoy]  [🛡 Kafolat]  [🚗 Yandex]
         ↓
Sotuvchi/o'rtachi tugma bosadi
         ↓
Bot ERP'dan ma'lumot oladi → PDF yaratadi → Guruhga yuboradi
```

---

## 🚀 Tez boshlash

### 1. .env faylni sozlash

```bash
cp .env.example .env
nano .env
```

```env
BOT_TOKEN=your_bot_token_here
GROUP_CHAT_ID=-1001234567890
ADMIN_IDS=123456789

ERP_API_URL=https://your-erp.com/api
ERP_API_TOKEN=your_token

COMPANY_NAME=Ibox.uz
COMPANY_PHONE=+998 XX XXX XX XX
```

### 2. Lokal ishga tushirish

```bash
npm install
npm run dev
```

### 3. Hetzner serverga deploy

```bash
# Server SSH orqali kirish
ssh root@your_server_ip

# Kodni klonlash
git clone https://github.com/your/printvoltrabot.git /opt/printvoltrabot
cd /opt/printvoltrabot

# .env sozlash
cp .env.example .env
nano .env

# Docker bilan ishga tushirish
chmod +x deploy.sh
./deploy.sh
```

---

## 📋 Komandalar

| Komanda | Tavsif |
|---------|--------|
| `/start` | Asosiy menyu |
| `/nakladnoy SH-11965` | Yuk xati PDF |
| `/garant SH-11965` | Kafolat hujjati PDF |
| `/help` | Yordam |

---

## 📄 PDF Hujjatlar

### Nakladnoy (Yuk Xati)
- Branded sarlavha (kompaniya logo va ma'lumotlari)
- Buyurtma raqami, sana, status
- Sotuvchi va xaridor ma'lumotlari
- Tovarlar jadvali (narxli/narxsiz variant)
- Yandex Delivery ma'lumotlari (ixtiyoriy)
- Imzo joylari
- QR kod

### Kafolat Hujjati
- Kafolat muddati (24 oy default)
- Kompaniya va mijoz ma'lumotlari
- Kafolat shartlari
- Kafolat bekor bo'lish holatlari
- 3 imzo joyi (muhur bilan)
- QR kod

---

## 🔧 Arxitektura

```
src/
├── bot/
│   ├── index.ts          # Bot yaratish
│   ├── commands/
│   │   ├── start.ts      # /start
│   │   ├── nakladnoy.ts  # /nakladnoy
│   │   └── garant.ts     # /garant
│   ├── handlers/
│   │   ├── message.ts    # Zayafka auto-detect
│   │   └── callback.ts   # Inline tugmalar
│   └── keyboards.ts      # Klaviatura shablonlar
├── pdf/
│   ├── generator.ts      # PDF yaratish (Puppeteer)
│   └── templates/
│       ├── nakladnoy.html
│       └── garant.html
├── erp/
│   └── client.ts         # ERP API (+ mock)
├── yandex/
│   └── delivery.ts       # Yandex Delivery API (+ mock)
├── database/
│   └── db.ts             # Prisma PostgreSQL
├── types/
│   └── erp.types.ts      # TypeScript interfacelar
├── config/
│   └── env.ts            # Muhit o'zgaruvchilari
└── utils/
    ├── logger.ts          # Winston logger
    └── parser.ts          # Xabar parser
```

---

## 🔌 ERP API ulanish

`src/erp/client.ts` faylida `mapToErpOrder()` metodini o'zgartiring:

```typescript
private mapToErpOrder(data: Record<string, unknown>): ErpOrder {
  return {
    id: String(data.id),
    orderNumber: String(data.order_number || data.id),
    status: String(data.status),
    date: String(data.date),
    // ... qolgan fieldlar
  };
}
```

---

## 🐳 Docker

```bash
# Build va ishga tushirish
docker-compose up -d

# Log ko'rish
docker-compose logs -f bot

# Qayta ishlatish
docker-compose restart bot

# To'xtatish
docker-compose down
```

---

## 📞 Yordam

Bot muammosi bo'lsa admin bilan bog'laning yoki log fayllarni tekshiring:

```bash
tail -f logs/combined.log
```

---

*Yaratdi: Printvoltrabot Team | Powered by grammY + Puppeteer*
# pdfgenerationBot
