import puppeteer, { Browser } from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import dayjs from 'dayjs';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { ErpOrder } from '../types/erp.types';
import { parseFullZayafkaMessage } from '../utils/parser';

// Handlebars helperlar
Handlebars.registerHelper('formatNumber', (num: number) => {
  if (!num) return '0';
  return num.toLocaleString('ru-RU');
});

Handlebars.registerHelper('add', (a: number, b: number) => a + b);
Handlebars.registerHelper('join', (arr: string[], sep: string) => arr?.join(sep) || '');
Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);


let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

async function generateQRCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 100,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}

function ensureOutputDir(): void {
  const dir = config.pdf.outputDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ===========================
// NAKLADNOY PDF
// ===========================
export async function generateNakladnoy(
  order: ErpOrder,
  options: {
    showPrices?: boolean;
    yandexInfo?: { price: number; eta: string; trackingUrl?: string; currency?: string };
  } = {}
): Promise<string> {
  ensureOutputDir();

  const templatePath = path.join(__dirname, 'templates', 'nakladnoy.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateHtml);

  // QR Code
  const qrCode = await generateQRCode(
    `${config.company.website}/order/${order.orderNumber}`
  );

  const totalAmount = order.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const deliveryPrice = options.yandexInfo?.price ? options.yandexInfo.price : 0;

  const data = {
    // Kompaniya
    companyName: config.company.name,
    companyAddress: config.company.address,
    companyPhone: config.company.phone,
    companyEmail: config.company.email,
    companyWebsite: config.company.website,
    companyInn: config.company.inn,

    // Buyurtma
    orderNumber: order.orderNumber,
    orderDate: order.date,
    status: order.status,
    createdAt: dayjs().format('DD.MM.YYYY HH:mm'),

    // Xodimlar
    managerName: order.managerName,
    warehouse: order.warehouse,

    // Mijoz
    clientName: order.client.name,
    clientPhone: order.client.phone,
    clientAddress: order.client.address || '—',

    // Tovarlar
    items: order.items,
    totalItems: order.items.reduce((sum, i) => sum + i.quantity, 0),

    // Narxlar
    showPrices: options.showPrices || false,
    totalAmount: options.showPrices ? totalAmount : null,
    deliveryPrice: options.showPrices && options.yandexInfo ? deliveryPrice : null,

    // Yandex
    yandexInfo: options.yandexInfo || null,

    // QR
    qrCode,
  };

  const html = template(data);
  const filePath = path.join(
    config.pdf.outputDir,
    `nakladnoy_${order.orderNumber}_${Date.now()}.pdf`
  );

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    logger.info(`✅ Nakladnoy PDF yaratildi: ${filePath}`);
    return filePath;
  } finally {
    await page.close();
  }
}

// ===========================
// GARANT PDF
// ===========================
export async function generateGarant(order: ErpOrder): Promise<string> {
  ensureOutputDir();

  const templatePath = path.join(__dirname, 'templates', 'garant.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateHtml);

  // Kafolat muddati (birinchi mahsulot bo'yicha yoki default 24 oy)
  const warrantyMonths = order.items[0]?.warrantyMonths || 24;
  const warrantyEndDate = dayjs(order.date, 'DD.MM.YYYY')
    .add(warrantyMonths, 'month')
    .format('DD.MM.YYYY');

  // QR Code
  const qrCode = await generateQRCode(
    `${config.company.website}/warranty/${order.orderNumber}`
  );

  const data = {
    // Kompaniya
    companyName: config.company.name,
    companyAddress: config.company.address,
    companyPhone: config.company.phone,
    companyEmail: config.company.email,
    companyWebsite: config.company.website,
    companyInn: config.company.inn,

    // Buyurtma
    orderNumber: order.orderNumber,
    orderDate: order.date,
    createdAt: dayjs().format('DD.MM.YYYY HH:mm'),

    // Xodimlar
    managerName: order.managerName,
    warehouse: order.warehouse,

    // Mijoz
    clientName: order.client.name,
    clientPhone: order.client.phone,

    // Kafolat
    warrantyMonths,
    warrantyEndDate,

    // Tovarlar
    items: order.items,
    showSerials: order.items.some(i => i.serialNumbers && i.serialNumbers.length > 0),

    // QR
    qrCode,
  };

  const html = template(data);
  const filePath = path.join(
    config.pdf.outputDir,
    `garant_${order.orderNumber}_${Date.now()}.pdf`
  );

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    logger.info(`✅ Garant PDF yaratildi: ${filePath}`);
    return filePath;
  } finally {
    await page.close();
  }
}

// PDF faylni o'chirish (yuborilgandan keyin)
export async function deletePdfFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error('PDF faylni o\'chirishda xato:', error);
  }
}

// ===========================
// ZAYAFKA PDF (To'g'ridan-to'g'ri Telegram xabaridan)
// ===========================
export async function generateZayafkaPdf(rawText: string): Promise<string> {
  const order = parseFullZayafkaMessage(rawText);

  if (!order) {
    throw new Error('Xabardan buyurtma ma\'lumotlari topilmadi');
  }

  ensureOutputDir();

  const templatePath = path.join(__dirname, 'templates', 'zayafka.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateHtml);


  // Logo — base64 formatida
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'assets', 'voltra icon.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch {
    logger.warn('Logo fayl topilmadi');
  }

  const data = {
    // Kompaniya
    companyName: config.company.name,
    companyAddress: config.company.address,
    companyPhone: config.company.phone,
    companyPhone2: config.company.phone2,
    companyEmail: config.company.email,
    companyWebsite: config.company.website,
    companyInn: config.company.inn,

    logoBase64,

    // Buyurtma
    orderNumber: order.orderNumber,
    orderDate: (() => {
      // "28.04.2026" → "28 APR 2026"
      const months = ['JAN','FEB','MAR','APR','MAY','IYN','IYL','AVG','SEP','OKT','NOY','DEK'];
      const parts = order.date.split('.');
      if (parts.length === 3) {
        const day = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const year = parts[2];
        return `${day} ${months[monthIdx] || parts[1]} ${year}`;
      }
      return order.date;
    })(),
    orderDateFormatted: dayjs().format('DD MMMM YYYY').toUpperCase(),
    status: order.status,
    createdAt: dayjs().format('DD.MM.YYYY HH:mm'),

    // Xodimlar
    createdBy: order.createdBy,
    createdByRole: order.createdByRole,
    managerName: order.managerName,
    managerRole: order.managerRole,

    // Mijoz
    clientName: order.client.name,
    clientPhone: order.client.phone,
    clientAddress: order.client.address || '—',

    // Ombor
    warehouse: order.warehouse,

    // Tovarlar
    items: order.items,
    totalItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
    totalAmount: order.totalAmount,
    currency: order.currency || 'UZS',

    // Izoh
    notes: order.notes || '',
  };

  const html = template(data);
  const filePath = path.join(
    config.pdf.outputDir,
    `zayafka_${order.orderNumber}_${Date.now()}.pdf`
  );

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    logger.info(`✅ Zayafka PDF yaratildi: ${filePath}`);
    return filePath;
  } finally {
    await page.close();
  }
}

// ===========================
// CLIENT PDF (narx va izohsiz)
// ===========================
export async function generateClientPdf(rawText: string): Promise<string> {
  const order = parseFullZayafkaMessage(rawText);

  if (!order) {
    throw new Error('Xabardan buyurtma ma\'lumotlari topilmadi');
  }

  ensureOutputDir();

  const templatePath = path.join(__dirname, 'templates', 'zayafka_client.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateHtml);

  // Logo — base64 formatida
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'assets', 'voltra icon.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch {
    logger.warn('Logo fayl topilmadi');
  }

  const data = {
    companyName: config.company.name,
    companyPhone: config.company.phone,
    companyPhone2: config.company.phone2,
    companyWebsite: config.company.website,
    logoBase64,
    orderNumber: order.orderNumber,
    orderDate: (() => {
      const months = ['JAN','FEB','MAR','APR','MAY','IYN','IYL','AVG','SEP','OKT','NOY','DEK'];
      const parts = order.date.split('.');
      if (parts.length === 3) {
        return `${parts[0]} ${months[parseInt(parts[1], 10) - 1] || parts[1]} ${parts[2]}`;
      }
      return order.date;
    })(),
    managerName: order.managerName,
    clientName: order.client.name,
    warehouse: order.warehouse,
    items: order.items,
    totalItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
    // narx va izoh YO'Q
  };

  const html = template(data);
  const filePath = path.join(
    config.pdf.outputDir,
    `client_${order.orderNumber}_${Date.now()}.pdf`
  );

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    logger.info(`✅ Mijoz PDF yaratildi: ${filePath}`);
    return filePath;
  } finally {
    await page.close();
  }
}

// Browser yopish
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
