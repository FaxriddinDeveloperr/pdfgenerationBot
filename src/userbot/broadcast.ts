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
  times: string[];
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
        times: ['09:10', '14:00'],
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

    return raw as BroadcastConfig;
  } catch (err) {
    logger.error('broadcast.json o\'qishda xato:', err);
    return { groups: [], ads: [], times: ['09:10', '14:00'], ownerId: '' };
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
    `${i + 1}. ID: \`${a.id}\` • Tur: ${a.mediaType}`
  );
  return `📢 Reklamalar (${config.ads.length} ta):\n\n${lines.join('\n')}\n\n/showad <N> — ko'rish\n/removead <N> — o'chirish`;
}

// ============================================================
// VAQT boshqarish
// ============================================================
export function addTime(time: string): { success: boolean; message: string } {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { success: false, message: '❌ HH:MM shaklida kiriting. Masalan: /addtime 09:10' };
  }
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) {
    return { success: false, message: '❌ Noto\'g\'ri vaqt.' };
  }
  const config = readConfig();
  if (config.times.includes(time)) {
    return { success: false, message: `❌ Bu vaqt allaqachon bor: ${time}` };
  }
  config.times.push(time);
  config.times.sort();
  saveConfig(config);
  return { success: true, message: `✅ Vaqt qo'shildi: ${time}` };
}

export function removeTime(time: string): { success: boolean; message: string } {
  const config = readConfig();
  const idx = config.times.indexOf(time);
  if (idx === -1) return { success: false, message: `❌ Topilmadi: ${time}` };
  config.times.splice(idx, 1);
  saveConfig(config);
  return { success: true, message: `✅ Vaqt o'chirildi: ${time}` };
}

export function listTimes(): string {
  const config = readConfig();
  if (!config.times.length) return '🕐 Vaqtlar belgilanmagan.';
  return `🕐 Vaqtlar (${config.times.length} ta):\n${config.times.join('\n')}`;
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
    ? `✅ ${config.ads.length} ta reklama`
    : `❌ Reklama yo'q`;

  const timeStatus = config.times.length > 0
    ? config.times.map(t => `🕐 ${t}`).join('   ')
    : `❌ Belgilanmagan`;

  return (
    `╔══════════════════════╗\n` +
    `║  📡  BROADCAST PANEL  ║\n` +
    `╚══════════════════════╝\n\n` +

    `━━━ 📊 Holat ━━━━━━━━━━━━━\n` +
    `👥 Guruhlar:   ${groupStatus}\n` +
    `📢 Reklamalar: ${adStatus}\n` +
    `⏰ Jadval:     ${timeStatus}\n\n` +

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
    `/clearads          — hammasini o'chirish\n\n` +

    `━━━ ⏰ Jadval ━━━━━━━━━━━━\n` +
    `/addtime HH:MM     — vaqt qo'shish\n` +
    `/removetime HH:MM  — vaqt o'chirish\n` +
    `/listtimes         — vaqtlar\n\n` +

    `━━━ 🚀 Boshqaruv ━━━━━━━━━\n` +
    `/sendnow           — hoziroq yuborish\n` +
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
    `Test yuborish:\n` +
    `  /sendnow\n\n` +
    `To'liq panel:\n` +
    `  /status`
  );
}

// ============================================================
// BROADCAST — barcha reklamalarni barcha guruhlarga yuborish
// ============================================================
export async function sendBroadcast(client: TelegramClient): Promise<void> {
  const config = readConfig();

  if (!config.ads.length) {
    logger.warn('📭 Broadcast: reklamalar yo\'q, o\'tkazib yuborildi.');
    return;
  }
  if (!config.groups.length) {
    logger.warn('📭 Broadcast: guruhlar yo\'q, o\'tkazib yuborildi.');
    return;
  }

  logger.info(`📢 Broadcast: ${config.ads.length} reklama × ${config.groups.length} guruh`);

  for (const group of config.groups) {
    for (const ad of config.ads) {
      try {
        await client.forwardMessages(group.id, {
          messages: [ad.messageId],
          fromPeer: ad.chatId,
        });
        logger.info(`✅ Yuborildi: "${group.title}" (reklama #${ad.id})`);
        // Reklamalar orasida 1 soniya pauza
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        logger.error(`❌ Xato (${group.title}, reklama #${ad.id}): ${err?.message || err}`);
      }
    }
    // Guruhlar orasida 2 soniya pauza (spam himoya)
    await new Promise(r => setTimeout(r, 2000));
  }

  logger.info('📢 Broadcast yakunlandi.');
}

// ============================================================
// CRON SCHEDULER
// ============================================================
let scheduledJobs: cron.ScheduledTask[] = [];

export function startScheduler(client: TelegramClient): void {
  stopScheduler();
  const config = readConfig();

  if (!config.times.length) {
    logger.info('🕐 Broadcast: vaqtlar yo\'q, scheduler ishlamadi.');
    return;
  }

  for (const time of config.times) {
    const [hour, minute] = time.split(':');
    const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
      logger.info(`⏰ Broadcast vaqti: ${time}`);
      await sendBroadcast(client);
    }, { timezone: 'Asia/Tashkent' });

    scheduledJobs.push(job);
    logger.info(`⏰ Scheduler: ${time} (Toshkent vaqti)`);
  }
}

export function stopScheduler(): void {
  scheduledJobs.forEach(j => j.stop());
  scheduledJobs = [];
}

export function restartScheduler(client: TelegramClient): void {
  logger.info('🔄 Scheduler qayta yuklanmoqda...');
  startScheduler(client);
}
