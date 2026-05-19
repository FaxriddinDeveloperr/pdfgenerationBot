import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { TelegramClient } from 'telegram';
import { logger } from '../utils/logger';

// ============================================================
// Ma'lumotlar strukturasi
// ============================================================
export interface BroadcastGroup {
  id: string;
  title: string;
  link?: string;
}

export interface AdItem {
  id: number;
  messageId: number;
  chatId: string;
  mediaType: string;
}

export interface BroadcastConfig {
  groups: BroadcastGroup[];
  ads: AdItem[];
  currentIndex: number;
  ownerId: string;
}

// ============================================================
// Fayl yo'li
// ============================================================
const DATA_PATH = path.join(process.cwd(), 'data', 'broadcast.json');

// ============================================================
// Config o'qish / yozish
// ============================================================
export function readConfig(): BroadcastConfig {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const def: BroadcastConfig = {
        groups: [],
        ads: [],
        currentIndex: 0,
        ownerId: process.env.BROADCAST_OWNER_ID || '',
      };
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(def, null, 2));
      return def;
    }

    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

    // Eski format (adMessageId) → yangi format (ads[]) ga ko'chirish
    if (!Array.isArray(raw.ads)) {
      raw.ads = raw.adMessageId
        ? [{ id: 1, messageId: raw.adMessageId, chatId: raw.adChatId, mediaType: raw.adMediaType || 'unknown' }]
        : [];
      delete raw.adMessageId;
      delete raw.adChatId;
      delete raw.adMediaType;
      fs.writeFileSync(DATA_PATH, JSON.stringify(raw, null, 2));
    }
    // Eski format (times) -> yangi format (currentIndex) ga ko'chirish
    if (typeof raw.currentIndex !== 'number') {
      raw.currentIndex = 0;
      delete raw.times;
      fs.writeFileSync(DATA_PATH, JSON.stringify(raw, null, 2));
    }

    return raw as BroadcastConfig;
  } catch (err) {
    logger.error('broadcast.json o\'qishda xato:', err);
    return { groups: [], ads: [], currentIndex: 0, ownerId: '' };
  }
}

export function saveConfig(config: BroadcastConfig): void {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    logger.error('broadcast.json yozishda xato:', err);
  }
}

// ============================================================
// GURUH boshqarish
// ============================================================
export function addGroup(group: BroadcastGroup): { success: boolean; message: string } {
  const config = readConfig();
  if (config.groups.find(g => g.id === group.id)) {
    return { success: false, message: `❌ Bu guruh allaqachon qo'shilgan: ${group.title}` };
  }
  config.groups.push(group);
  saveConfig(config);
  return { success: true, message: `✅ Qo'shildi: ${group.title}` };
}

export function removeGroup(index: number): { success: boolean; message: string } {
  const config = readConfig();
  if (index < 1 || index > config.groups.length) {
    return { success: false, message: `❌ 1 dan ${config.groups.length} gacha raqam kiriting.` };
  }
  const removed = config.groups.splice(index - 1, 1)[0];
  saveConfig(config);
  return { success: true, message: `✅ O'chirildi: ${removed.title}` };
}

export function listGroups(): string {
  const config = readConfig();
  if (!config.groups.length) return '📋 Guruhlar yo\'q. /addgroup <link> bilan qo\'shing.';
  const lines = config.groups.map((g, i) =>
    `${i + 1}. *${g.title}*\n   ID: \`${g.id}\``
  );
  return `📋 Guruhlar (${config.groups.length} ta):\n\n${lines.join('\n\n')}`;
}

// ============================================================
// REKLAMA boshqarish
// ============================================================
export function addAd(messageId: number, chatId: string, mediaType: string): AdItem {
  const config = readConfig();
  const nextId = config.ads.length > 0 ? Math.max(...config.ads.map(a => a.id)) + 1 : 1;
  const ad: AdItem = { id: nextId, messageId, chatId, mediaType };
  config.ads.push(ad);
  saveConfig(config);
  return ad;
}

export function removeAd(index: number): { success: boolean; message: string } {
  const config = readConfig();
  if (index < 1 || index > config.ads.length) {
    return { success: false, message: `❌ 1 dan ${config.ads.length} gacha raqam kiriting.` };
  }
  const removed = config.ads.splice(index - 1, 1)[0];
  saveConfig(config);
  return { success: true, message: `✅ Reklama #${removed.id} o'chirildi (${removed.mediaType}).` };
}

export function clearAds(): void {
  const config = readConfig();
  config.ads = [];
  saveConfig(config);
}

export function listAds(): string {
  const config = readConfig();
  if (!config.ads.length) return '📭 Reklamalar yo\'q. /setad bilan qo\'shing.';
  const lines = config.ads.map((a, i) =>
    `${i + 1}. ID: \`${a.id}\` • Tur: ${a.mediaType}` + (i === config.currentIndex ? ' 👈 (navbatdagi)' : '')
  );
  return `📢 Reklamalar (${config.ads.length} ta):\n\n${lines.join('\n')}\n\n/showad <N> — ko'rish\n/removead <N> — o'chirish`;
}

// ============================================================
// NAVBAT boshqarish
// ============================================================
export function resetIndex(): { success: boolean; message: string } {
  const config = readConfig();
  config.currentIndex = 0;
  saveConfig(config);
  return { success: true, message: `✅ Reklama navbati boshiga qaytarildi.` };
}

// ============================================================
// STATUS — professional format
// ============================================================
export function getStatus(): string {
  const config = readConfig();

  const groupStatus  = config.groups.length > 0
    ? `✅ ${config.groups.length} ta guruh`
    : `❌ Guruh yo'q`;

  const adStatus = config.ads.length > 0
    ? `✅ ${config.ads.length} ta reklama (navbat: ${config.currentIndex + 1})`
    : `❌ Reklama yo'q`;

  return (
    `╔══════════════════════╗\n` +
    `║  📡  BROADCAST PANEL  ║\n` +
    `╚══════════════════════╝\n\n` +

    `━━━ 📊 Holat ━━━━━━━━━━━━━\n` +
    `👥 Guruhlar:   ${groupStatus}\n` +
    `📢 Reklamalar: ${adStatus}\n` +
    `⏰ Jadval:     Har 20 daqiqada (09:00 dan 18:59 gacha)\n\n` +

    `━━━ 👥 Guruhlar ━━━━━━━━━━\n` +
    `/addgroup <link>   — qo'shish\n` +
    `/bulk_add <links>  — ko'p qo'shish\n` +
    `/listgroups        — ro'yxat\n` +
    `/removegroup <N>   — o'chirish\n\n` +

    `━━━ 📢 Reklamalar ━━━━━━━━\n` +
    `/setad             — qo'shish\n` +
    `/listads           — ro'yxat\n` +
    `/showad <N>        — ko'rish\n` +
    `/removead <N>      — o'chirish\n` +
    `/clearads          — hammasini o'chirish\n` +
    `/resetindex        — navbatni boshidan boshlash\n\n` +

    `━━━ 🚀 Boshqaruv ━━━━━━━━━\n` +
    `/sendnow           — bitta reklamani hoziroq barcha guruhlarga yuborish\n` +
    `/status            — bu panel`
  );
}

export function getHelp(): string {
  return (
    `╔══════════════════════╗\n` +
    `║  📡  BROADCAST PANEL  ║\n` +
    `╚══════════════════════╝\n\n` +
    `Guruh qo'shish:\n` +
    `  /addgroup https://t.me/username\n` +
    `  /addgroup https://t.me/+InviteHash\n\n` +
    `Reklama qo'shish:\n` +
    `  /setad  → keyin xabar yuboring\n\n` +
    `Test yuborish (navbatdagi bitta reklama):\n` +
    `  /sendnow\n\n` +
    `To'liq panel:\n` +
    `  /status`
  );
}

// ============================================================
// BROADCAST — bitta navbatdagi reklamani barcha guruhlarga yuborish
// ============================================================
export async function sendBroadcast(client: TelegramClient): Promise<void> {
  let config = readConfig();

  if (!config.ads.length) {
    logger.warn('📭 Broadcast: reklamalar yo\'q, o\'tkazib yuborildi.');
    return;
  }
  if (!config.groups.length) {
    logger.warn('📭 Broadcast: guruhlar yo\'q, o\'tkazib yuborildi.');
    return;
  }

  // Indeks chegaradan chiqib ketgan bo'lsa to'g'rilash (masalan reklama o'chirilgan bo'lsa)
  if (config.currentIndex >= config.ads.length) {
    config.currentIndex = 0;
  }

  const ad = config.ads[config.currentIndex];

  logger.info(`📢 Broadcast: Reklama #${config.currentIndex + 1}/${config.ads.length} -> ${config.groups.length} ta guruhga`);

  for (const group of config.groups) {
    try {
      await client.forwardMessages(group.id, {
        messages: [ad.messageId],
        fromPeer: ad.chatId,
      });
      logger.info(`✅ Yuborildi: "${group.title}" (reklama #${ad.id})`);
    } catch (err: any) {
      logger.error(`❌ Xato (${group.title}, reklama #${ad.id}): ${err?.message || err}`);
    }
    // Guruhlar orasida 2 soniya pauza (spam himoya)
    await new Promise(r => setTimeout(r, 2000));
  }

  // Navbatni keyingisiga o'tkazish
  config.currentIndex = (config.currentIndex + 1) % config.ads.length;
  saveConfig(config);

  logger.info(`📢 Broadcast yakunlandi. Keyingi navbat: #${config.currentIndex + 1}`);
}

// ============================================================
// CRON SCHEDULER (Har 20 daqiqada: 09:00 dan 18:59 gacha)
// ============================================================
let scheduledJobs: cron.ScheduledTask[] = [];

export function startScheduler(client: TelegramClient): void {
  stopScheduler();
  const config = readConfig();

  if (!config.ads.length) {
    logger.info('🕐 Broadcast: reklamalar yo\'q, scheduler ishlamadi.');
    // Keep it running actually, in case they add later, but it's okay, we can restart on /setad.
  }

  // "*/20 9-18 * * *" -> Har soatning 0, 20, 40 daqiqalarida, soat 09:00 dan 18:59 gacha
  const scheduleTime = '*/20 9-18 * * *';
  
  const job = cron.schedule(scheduleTime, async () => {
    logger.info(`⏰ Broadcast vaqti (Har 20 daqiqada)`);
    await sendBroadcast(client);
  }, { timezone: 'Asia/Tashkent' });

  scheduledJobs.push(job);
  logger.info(`⏰ Scheduler o'rnatildi: ${scheduleTime} (Toshkent vaqti: 09:00 dan 18:59 gacha har 20 daqiqa)`);
}

export function stopScheduler(): void {
  scheduledJobs.forEach(j => j.stop());
  scheduledJobs = [];
}

export function restartScheduler(client: TelegramClient): void {
  logger.info('🔄 Scheduler qayta yuklanmoqda...');
  startScheduler(client);
}
