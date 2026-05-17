import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { TelegramClient } from 'telegram';
import { logger } from '../utils/logger';

// ============================================================
// Ma'lumotlar strukturasi
// ============================================================
export interface BroadcastGroup {
  id: string;       // Guruh ID (masalan: -1001234567890)
  title: string;    // Guruh nomi
  link?: string;    // Asl link (t.me/...)
}

export interface BroadcastConfig {
  groups: BroadcastGroup[];
  adMessageId: number | null;   // Reklama xabarining ID si
  adChatId: string | null;      // Reklama xabari saqlangan chat ID
  adMediaType: string | null;   // text | photo | video | voice | video_note
  times: string[];              // ["09:10", "14:00"]
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
      const defaultConfig: BroadcastConfig = {
        groups: [],
        adMessageId: null,
        adChatId: null,
        adMediaType: null,
        times: ['09:10', '14:00'],
        ownerId: process.env.BROADCAST_OWNER_ID || '',
      };
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (err) {
    logger.error('broadcast.json o\'qishda xato:', err);
    return { groups: [], adMessageId: null, adChatId: null, adMediaType: null, times: ['09:10', '14:00'], ownerId: '' };
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
// Guruh boshqarish
// ============================================================
export function addGroup(group: BroadcastGroup): { success: boolean; message: string } {
  const config = readConfig();
  const exists = config.groups.find(g => g.id === group.id);
  if (exists) {
    return { success: false, message: `❌ Bu guruh allaqachon qo'shilgan: ${group.title}` };
  }
  config.groups.push(group);
  saveConfig(config);
  return { success: true, message: `✅ Guruh qo'shildi: ${group.title} (ID: ${group.id})` };
}

export function removeGroup(index: number): { success: boolean; message: string } {
  const config = readConfig();
  if (index < 1 || index > config.groups.length) {
    return { success: false, message: `❌ Noto'g'ri raqam. 1 dan ${config.groups.length} gacha kiriting.` };
  }
  const removed = config.groups.splice(index - 1, 1)[0];
  saveConfig(config);
  return { success: true, message: `✅ O'chirildi: ${removed.title}` };
}

export function listGroups(): string {
  const config = readConfig();
  if (config.groups.length === 0) {
    return '📋 Hozircha guruhlar yo\'q. /addgroup <link> bilan qo\'shing.';
  }
  const lines = config.groups.map((g, i) =>
    `${i + 1}. ${g.title}\n   ID: ${g.id}${g.link ? `\n   Link: ${g.link}` : ''}`
  );
  return `📋 Saqlangan guruhlar (${config.groups.length} ta):\n\n${lines.join('\n\n')}`;
}

// ============================================================
// Reklama xabarini saqlash
// ============================================================
export function saveAd(messageId: number, chatId: string, mediaType: string): void {
  const config = readConfig();
  config.adMessageId = messageId;
  config.adChatId = chatId;
  config.adMediaType = mediaType;
  saveConfig(config);
}

export function getAdInfo(): string {
  const config = readConfig();
  if (!config.adMessageId) {
    return '📭 Reklama xabari o\'rnatilmagan.\n/setad buyrug\'idan keyin reklama xabarini yuboring.';
  }
  return `📢 Reklama o'rnatilgan\nTur: ${config.adMediaType || 'noma\'lum'}\nXabar ID: ${config.adMessageId}`;
}

// ============================================================
// Vaqt boshqarish
// ============================================================
export function addTime(time: string): { success: boolean; message: string } {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { success: false, message: '❌ Noto\'g\'ri format. HH:MM shaklida kiriting. Masalan: 09:10' };
  }
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) {
    return { success: false, message: '❌ Noto\'g\'ri vaqt. 00:00 — 23:59 oralig\'ida bo\'lishi kerak.' };
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
  if (idx === -1) {
    return { success: false, message: `❌ Bunday vaqt topilmadi: ${time}` };
  }
  config.times.splice(idx, 1);
  saveConfig(config);
  return { success: true, message: `✅ Vaqt o'chirildi: ${time}` };
}

export function listTimes(): string {
  const config = readConfig();
  if (config.times.length === 0) {
    return '🕐 Hozircha vaqtlar belgilanmagan.';
  }
  return `🕐 Belgilangan vaqtlar (${config.times.length} ta):\n${config.times.join('\n')}`;
}

// ============================================================
// Status
// ============================================================
export function getStatus(): string {
  const config = readConfig();
  return (
    `📊 *Broadcast tizimi holati*\n\n` +
    `👥 Guruhlar: ${config.groups.length} ta\n` +
    `📢 Reklama: ${config.adMessageId ? '✅ O\'rnatilgan' : '❌ O\'rnatilmagan'}\n` +
    `🕐 Vaqtlar: ${config.times.length > 0 ? config.times.join(', ') : 'Belgilanmagan'}\n\n` +
    `*Buyruqlar:*\n` +
    `/addgroup <link> — guruh qo'shish\n` +
    `/removegroup <N> — guruh o'chirish\n` +
    `/listgroups — guruhlar ro'yxati\n` +
    `/setad — reklama o'rnatish\n` +
    `/showad — reklamani ko'rish\n` +
    `/addtime HH:MM — vaqt qo'shish\n` +
    `/removetime HH:MM — vaqt o'chirish\n` +
    `/listtimes — vaqtlar ro'yxati\n` +
    `/sendnow — hoziroq yuborish\n` +
    `/status — holat`
  );
}

// ============================================================
// Reklama yuborish
// ============================================================
export async function sendBroadcast(client: TelegramClient): Promise<void> {
  const config = readConfig();

  if (!config.adMessageId || !config.adChatId) {
    logger.warn('📭 Broadcast: reklama xabari o\'rnatilmagan, o\'tkazib yuborildi.');
    return;
  }

  if (config.groups.length === 0) {
    logger.warn('📭 Broadcast: guruhlar yo\'q, o\'tkazib yuborildi.');
    return;
  }

  logger.info(`📢 Broadcast boshlandi: ${config.groups.length} ta guruh`);

  let successCount = 0;
  let failCount = 0;

  for (const group of config.groups) {
    try {
      // Xabarni forward qilish
      await client.forwardMessages(group.id, {
        messages: [config.adMessageId],
        fromPeer: config.adChatId,
      });
      successCount++;
      logger.info(`✅ Yuborildi: ${group.title}`);

      // Har bir guruh orasida 1.5 soniya kutish (spam oldini olish)
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err: any) {
      failCount++;
      logger.error(`❌ Yuborishda xato (${group.title}): ${err?.message || err}`);
    }
  }

  logger.info(`📢 Broadcast yakunlandi: ✅${successCount} muvaffaqiyatli, ❌${failCount} xatolik`);
}

// ============================================================
// Cron scheduler — barcha vaqtlarni ishga tushirish
// ============================================================
let scheduledJobs: cron.ScheduledTask[] = [];

export function startScheduler(client: TelegramClient): void {
  // Avvalgi joblarni to'xtatish
  stopScheduler();

  const config = readConfig();

  if (config.times.length === 0) {
    logger.info('🕐 Broadcast: vaqtlar belgilanmagan, scheduler ishga tushmadi.');
    return;
  }

  for (const time of config.times) {
    const [hour, minute] = time.split(':');
    const cronExpr = `${minute} ${hour} * * *`;  // Har kuni ushbu vaqtda

    try {
      const job = cron.schedule(cronExpr, async () => {
        logger.info(`⏰ Broadcast vaqti keldi: ${time}`);
        await sendBroadcast(client);
      }, {
        timezone: 'Asia/Tashkent',
      });

      scheduledJobs.push(job);
      logger.info(`⏰ Broadcast scheduler o'rnatildi: ${time} (Toshkent vaqti)`);
    } catch (err) {
      logger.error(`Scheduler xatosi (${time}):`, err);
    }
  }
}

export function stopScheduler(): void {
  for (const job of scheduledJobs) {
    job.stop();
  }
  scheduledJobs = [];
}

// Schedulerni qayta yuklash (vaqt o'zgarganda)
export function restartScheduler(client: TelegramClient): void {
  logger.info('🔄 Broadcast scheduler qayta yuklanmoqda...');
  startScheduler(client);
}
