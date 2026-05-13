import { ParsedZayafka, ErpOrder, ErpOrderItem } from '../types/erp.types';

// Markdown belgilarini tozalash — faqat **bold** va __underline__
// Single * ga tegmaymiz! Chunki mahsulot nomlarida 1*6 mm kabi yozuvlar bor
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')   // ** belgilarini olib tashlaymiz
    .replace(/__/g, '');    // __ belgilarini olib tashlaymiz
}


// ============================================================
// FORMAT 1 (O'zbek):
// 🛒 Yangi sotuv! #SH-11965
// 🗓 Sana: 25.04.2026 | 🗓 Дата: 28.04.2026
// 🙋 Yaratdi / Создал: ...
// 🧑 Javobgar / Ответственный: ...
// 🙍 Mijoz / Клиент: ...
// 📞 Telefon / Телефон: ...
// 🏠 Ombor / Склад: ...
// #1. Tovar nomi - 8 шт
// 💬 izoh
// /nakladnoy  ← shu bo'lsa avtomatik PDF
//
// FORMAT 2 (Rus):
// 🛒 Новая отгрузка! #228
// ...
// /nakladnoy  ← shu bo'lsa avtomatik PDF
// ============================================================

// Xabarda /nakladnoy yoki /garant bormi?
export function hasNakladnoyCommand(text: string): boolean {
  return /\/nakladnoy/i.test(text);
}

export function hasGarantCommand(text: string): boolean {
  return /\/garant/i.test(text);
}

export function isZayafkaMessage(text: string): boolean {
  const indicators = [
    /yangi\s+sotuv/i,
    /нова[яа]\s+отгрузка/i,   // Новая отгрузка
    /изменена\s+отгрузка/i,  // Изменена отгрузка
    /новый\s+заказ/i,
    /закупка/i,               // Закупка
    /🛒/,
    /#SH-\d+/i,
    /zayafka/i,
  ];
  return indicators.some((pattern) => pattern.test(text));
}

export function parseZayafkaMessage(
  text: string,
  messageId: number,
  chatId: string
): ParsedZayafka | null {
  const orderPatterns = [
    /#(SH-\d+)/i,                          // #SH-11965
    /отгрузка[!\s!]*#(\d+)/i,           // Новая отгрузка! #228 | Изменена отгрузка ! #279
    /sotuv[^\n#]*#([A-Z]{0,3}-?\d+)/i,   // Yangi sotuv! #SH-11965
    /#(\d{2,10})\b/,                        // #228, #11965 — 2 raqamdan boshlab
    /№\s*([A-Z0-9-]+)/i,
  ];

  let orderNumber: string | null = null;
  for (const pattern of orderPatterns) {
    const match = text.match(pattern);
    if (match) {
      orderNumber = match[1].toUpperCase();
      break;
    }
  }

  if (!orderNumber) return null;
  return { orderNumber, rawMessage: text, messageId, chatId };
}

// ============================================================
// TO'LIQ PARSE: O'zbek va Rus tillarini tushunadi
// ============================================================
export function parseFullZayafkaMessage(rawText: string): ErpOrder | null {
  // Markdown belgilarini tozalaymiz (**bold** → bold)
  const text = cleanMarkdown(rawText);

  // --- Buyurtma raqami ---
  const orderMatch =
    text.match(/отгрузка\s*!?\s*#(\d+)/i) ||
    text.match(/закупка[^\n#]*#(\d+)/i) ||
    text.match(/sotuv[^\n#]*#([A-Z]{0,3}-?\d+)/i) ||
    text.match(/#(SH-\d+)/i) ||
    text.match(/#(\d{2,10})\b/);
  if (!orderMatch) return null;
  const orderNumber = orderMatch[1].toUpperCase();

  // --- Status ---
  const statusMatch =
    text.match(/⚠️\s*Status:\s*(.+)/i) ||
    text.match(/Status:\s*(.+)/i);
  const status = statusMatch ? statusMatch[1].trim() : 'Yangi';

  // --- Sana (o'zbek: Sana, rus: Дата) ---
  const dateMatch =
    text.match(/🗓\s*(?:Sana|Дата):\s*([\d.]+)/i) ||
    text.match(/(?:^|\n)\s*(?:Sana|Дата):\s*([\d.]+)/im);
  const date = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString('ru-RU');

  // --- Yaratuvchi (o'zbek: Yaratdi, rus: Создал) ---
  const createdByMatch =
    text.match(/🙋[^\n]*(?:Yaratdi|Создал):\s*([^\n]+)/i) ||
    text.match(/(?:Yaratdi|Создал):\s*([^\n]+)/i);
  const createdByFull = createdByMatch ? createdByMatch[1].trim() : '';
  const { name: createdByName, role: createdByRole } = splitNameRole(createdByFull);

  // --- Javobgar (o'zbek: Javobgar, rus: Ответственный) ---
  const managerMatch =
    text.match(/🧑[^\n]*(?:Javobgar|Ответственный):\s*([^\n]+)/i) ||
    text.match(/(?:Javobgar|Ответственный):\s*([^\n]+)/i);
  const managerFull = managerMatch ? managerMatch[1].trim() : createdByFull;
  const { name: managerName, role: managerRole } = splitNameRole(managerFull);

  // --- Mijoz (o'zbek: Mijoz, rus: Клиент/Поставщик) ---
  const clientMatch =
    text.match(/🙍[^\n]*(?:Mijoz|Клиент|Поставщик):\s*([^\n]+)/i) ||
    text.match(/(?:Mijoz|Клиент|Поставщик):\s*([^\n]+)/i);
  const clientName = clientMatch ? clientMatch[1].trim() : '—';

  // --- Telefon ---
  const phoneMatch =
    text.match(/📞\s*(?:Telefon|Телефон|Номер клиента|Номер):\s*([^\n]+)/i) ||
    text.match(/(?:Telefon|Телефон|Номер клиента):\s*([^\n]+)/i);
  const rawPhone = phoneMatch ? phoneMatch[1].trim() : '—';
  const clientPhone = rawPhone === '+' || rawPhone === '' ? '—' : rawPhone;

  // --- Ombor (o'zbek: Ombor, rus: Склад) ---
  const warehouseMatch =
    text.match(/🏠\s*(?:Ombor|Склад):\s*([^\n]+)/i) ||
    text.match(/(?:Ombor|Склад):\s*([^\n]+)/i);
  const warehouse = warehouseMatch ? warehouseMatch[1].trim() : '—';

  // --- Tovarlar: #1. Jinko 620 W - 80 dn ---
  // (80 dn x 94.86 = 7588.8 USD) — bu qatorni o'tkazib yuborish kerak
  const itemRegex = /#(\d+)[.)]\s*([^\n(]+?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*([^\n#(]*)/gi;
  const items: ErpOrderItem[] = [];
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(text)) !== null) {
    const position = parseInt(itemMatch[1], 10);
    const name     = itemMatch[2].trim();
    const quantity = parseFloat(itemMatch[3].replace(',', '.'));
    // Birlikdan /nakladnoy komandalarini tozalash
    const unit     = itemMatch[4].trim().replace(/\/\w+/g, '').trim() || 'шт';

    // Faqat haqiqiy tovar pozitsiyalarini qo'shish (izoh qatorlari emas)
    if (name && name.length > 1 && !isNaN(quantity) && position > 0) {
      // Agar nom faqat raqam yoki belgilardan iborat bo'lsa, o'tkazib yubor
      if (!/^[\d\s.,]+$/.test(name)) {
        items.push({ position, name, quantity, unit });
      }
    }
  }

  // --- Jami summa (👉 Итого: 7 588.8 USD) ---
  const totalMatch =
    text.match(/👉\s*(?:Итого|Jami|Total):\s*([\d\s.,]+)\s*([A-Z]+)/i) ||
    text.match(/(?:Итого|Итог|Jami):\s*([\d\s.,]+)\s*([A-Z]+)/i);
  const totalAmount = totalMatch
    ? parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'))
    : undefined;
  const currency = totalMatch ? totalMatch[2].toUpperCase() : 'UZS';

  // --- Izoh (💬) — /nakladnoy /garant komandalarini olib tashlash ---
  const commentMatch = text.match(/💬\s*([^\n]+)/i);
  const notes = commentMatch
    ? commentMatch[1].replace(/\/nakladnoy|\/garant|\/\w+/gi, '').trim()
    : undefined;

  return {
    id: orderNumber,
    orderNumber,
    status,
    date,
    createdBy: createdByName,
    createdByRole,
    managerId: '',
    managerName,
    managerRole,
    client: { id: '', name: clientName, phone: clientPhone },
    warehouse,
    items,
    notes: notes || undefined,
    deliveryType: 'pickup',
    totalAmount,
    currency,
  };
}

function splitNameRole(full: string): { name: string; role: string } {
  const dashMatch = full.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (dashMatch) {
    return { name: dashMatch[1].trim(), role: dashMatch[2].trim() };
  }
  return { name: full, role: '' };
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('998') && cleaned.length === 12) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  return phone;
}

export function formatDateUz(date: Date): string {
  const months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatSum(amount: number, currency = 'UZS'): string {
  return `${amount.toLocaleString('ru-RU')} ${currency}`;
}
