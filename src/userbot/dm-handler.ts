import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram/tl';
import { logger } from '../utils/logger';
import {
  addGroup, removeGroup, listGroups,
  addAd, removeAd, clearAds, listAds,
  addTime, removeTime, listTimes,
  getStatus, getHelp, sendBroadcast, restartScheduler, readConfig,
} from './broadcast';

// /setad bosilgandan keyin keyingi xabar reklama bo'ladi
let waitingForAd = false;

export async function startDmHandler(client: TelegramClient): Promise<void> {
  const ownerIds = (process.env.BROADCAST_OWNER_ID || readConfig().ownerId).split(',').map(id => id.trim()).filter(Boolean);

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;
      if (!message) return;

      // Faqat shaxsiy xabarlar (DM)
      if (!message.isPrivate) return;

      // Faqat egasidan
      const senderId = message.senderId?.toString();
      if (!senderId || !ownerIds.includes(senderId)) return;

      const text = (message.text || '').trim();

      // ── /setad rejimi: keyingi xabar reklama ──────────────
      if (waitingForAd) {
        waitingForAd = false;

        // /cancelad matni yuborilgan bo'lsa — bekor qilish
        if (text === '/cancelad') {
          await reply(client, senderId, '✅ Bekor qilindi.');
          return;
        }

        const msgId = message.id;
        const chatId = senderId;

        let mediaType = 'text';
        if (message.photo)          mediaType = 'photo';
        else if (message.video)     mediaType = 'video';
        else if (message.voice)     mediaType = 'voice';
        else if (message.videoNote) mediaType = 'video_note';
        else if (message.document)  mediaType = 'document';

        const ad = addAd(msgId, chatId, mediaType);
        logger.info(`📢 Reklama qo'shildi: #${ad.id} type=${mediaType}`);

        await reply(client, senderId,
          `✅ Reklama qo'shildi!\n\n` +
          `🔢 Tartib raqami: *${ad.id}*\n` +
          `📁 Tur: ${mediaType}\n\n` +
          `Jami reklamalar: ${readConfig().ads.length} ta\n` +
          `/listads — ro'yxatni ko'rish\n` +
          `/setad — yana reklama qo'shish`,
          true
        );
        return;
      }

      const spaceIdx = text.search(/\s/);
      const cmd  = (spaceIdx === -1 ? text : text.slice(0, spaceIdx)).toLowerCase();
      const args = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim();

      switch (cmd) {

        // ━━━━ GURUH BOSHQARISH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        case '/addgroup': {
          if (!args) {
            await reply(client, senderId,
              '❌ Link kiriting:\n' +
              '/addgroup https://t.me/username\n' +
              '/addgroup https://t.me/+InviteHash'
            );
            break;
          }

          await reply(client, senderId, '⏳ Guruhga qo\'shilmoqda...');

          try {
            const res = await processGroupJoin(client, args);
            await reply(client, senderId,
              `✅ Muvaffaqiyatli!\n\n👥 *${res.title}*\n\n` +
              (res.success ? '💾 Saqlandi.' : res.message),
              true
            );
          } catch (err: any) {
            await reply(client, senderId,
              `❌ Xato: ${err?.message || err}\n\n` +
              `• Ochiq guruh: /addgroup https://t.me/username\n` +
              `• Yopiq guruh: /addgroup https://t.me/+InviteHash`
            );
          }
          break;
        }

        case '/bulk_add': {
          if (!args) {
            await reply(client, senderId, '❌ Guruh linklarini tashlang (har birini yangi qatordan yoki probel bilan).');
            break;
          }

          const links = args.split(/[\n\s]+/).filter(Boolean);
          await reply(client, senderId, `⏳ ${links.length} ta guruhga qo'shilish boshlandi...\n⚠️ Telegram bloklab qo'ymasligi uchun har bir guruh orasida 3 soniya kutiladi.`);

          let successCount = 0;
          let failCount = 0;
          const results: string[] = [];

          for (const link of links) {
            try {
              const res = await processGroupJoin(client, link);
              if (res.success) successCount++;
              results.push(`✅ ${res.title}`);
            } catch (err: any) {
              failCount++;
              results.push(`❌ ${link}: ${err?.message || 'Xato'}`);
            }
            await new Promise(r => setTimeout(r, 3000));
          }

          await reply(client, senderId,
            `📊 *Bulk Add Natijalari:*\n` +
            `✅ Muvaffaqiyatli: ${successCount} ta\n` +
            `❌ Xatolik: ${failCount} ta\n\n` +
            results.join('\n'),
            true
          );
          break;
        }

        case '/removegroup': {
          const n = parseInt(args);
          if (isNaN(n)) { await reply(client, senderId, '❌ Raqam kiriting: /removegroup 1'); break; }
          const res = removeGroup(n);
          await reply(client, senderId, res.message);
          break;
        }

        case '/listgroups':
          await reply(client, senderId, listGroups(), true);
          break;

        // ━━━━ REKLAMA BOSHQARISH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        case '/setad': {
          waitingForAd = true;
          await reply(client, senderId,
            '📢 Reklama xabarini yuboring!\n\n' +
            'Qo\'llab-quvvatlanadi:\n' +
            '• Matn\n• 🖼 Rasm + caption\n• 🎥 Video + caption\n• 🎵 Ovozli xabar\n• ⭕ Doiraviy video\n\n' +
            'Bekor qilish uchun /cancelad yuboring.'
          );
          break;
        }

        case '/cancelad': {
          waitingForAd = false;
          await reply(client, senderId, '✅ Bekor qilindi.');
          break;
        }

        case '/listads':
          await reply(client, senderId, listAds(), true);
          break;

        case '/showad': {
          const config = readConfig();
          const n = parseInt(args);
          const idx = isNaN(n) ? 0 : n - 1;
          if (!config.ads.length) { await reply(client, senderId, '📭 Reklamalar yo\'q.'); break; }
          const ad = config.ads[idx];
          if (!ad) { await reply(client, senderId, `❌ ${n}-reklama topilmadi.`); break; }
          try {
            await client.forwardMessages(senderId, { messages: [ad.messageId], fromPeer: ad.chatId });
            await reply(client, senderId, `ℹ️ Reklama #${idx + 1} (tur: ${ad.mediaType})`);
          } catch {
            await reply(client, senderId, `ID: ${ad.id} | Tur: ${ad.mediaType}`);
          }
          break;
        }

        case '/removead': {
          const n = parseInt(args);
          if (isNaN(n)) { await reply(client, senderId, '❌ Raqam kiriting: /removead 1'); break; }
          const res = removeAd(n);
          await reply(client, senderId, res.message);
          break;
        }

        case '/clearads': {
          clearAds();
          await reply(client, senderId, '✅ Barcha reklamalar o\'chirildi.');
          break;
        }

        // ━━━━ VAQT BOSHQARISH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        case '/addtime': {
          if (!args) { await reply(client, senderId, '❌ Masalan: /addtime 09:10'); break; }
          const res = addTime(args);
          await reply(client, senderId, res.message);
          if (res.success) { restartScheduler(client); await reply(client, senderId, '🔄 Scheduler yangilandi.'); }
          break;
        }

        case '/removetime': {
          if (!args) { await reply(client, senderId, '❌ Masalan: /removetime 14:00'); break; }
          const res = removeTime(args);
          await reply(client, senderId, res.message);
          if (res.success) { restartScheduler(client); await reply(client, senderId, '🔄 Scheduler yangilandi.'); }
          break;
        }

        case '/listtimes':
          await reply(client, senderId, listTimes());
          break;

        // ━━━━ YUBORISH VA STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        case '/sendnow': {
          const config = readConfig();
          if (!config.ads.length) { await reply(client, senderId, '❌ Reklama yo\'q: /setad'); break; }
          if (!config.groups.length) { await reply(client, senderId, '❌ Guruh yo\'q: /addgroup <link>'); break; }
          await reply(client, senderId,
            `⏳ Yuborilmoqda...\n📢 ${config.ads.length} reklama × 👥 ${config.groups.length} guruh`
          );
          await sendBroadcast(client);
          await reply(client, senderId, '✅ Yakunlandi!');
          break;
        }

        case '/status':
          await reply(client, senderId, getStatus(), true);
          break;

        case '/help':
        case '/start':
          await reply(client, senderId, getHelp());
          break;

        default:
          // Oddiy xabar — e'tiborsiz
          break;
      }

    } catch (err) {
      logger.error('DM handler xatosi:', err);
    }
  }, new NewMessage({ incoming: true }));

  logger.info(`✅ DM handler ishga tushdi (egalar: ${ownerIds.join(',')})`);
}

async function processGroupJoin(client: TelegramClient, rawLink: string): Promise<{ success: boolean; title: string; message: string }> {
  const link = rawLink.replace('https://', '').replace('http://', '').trim();
  const isInvite = link.includes('/+') || link.includes('joinchat/');
  let entity: any;

  if (isInvite) {
    const hash = link.split('/+').pop()?.replace('joinchat/', '') || link;
    try {
      await client.invoke(new Api.messages.ImportChatInvite({ hash }));
    } catch (e: any) {
      if (!e?.message?.includes('ALREADY')) throw e;
    }
    await new Promise(r => setTimeout(r, 1500));
    entity = await client.getEntity(link).catch(() => client.getEntity(hash));
  } else {
    const username = link.replace('t.me/', '').split('/')[0];
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: username }));
    } catch (e: any) {
      if (!e?.message?.includes('ALREADY')) throw e;
    }
    entity = await client.getEntity(username);
  }

  const gId    = entity.id?.toString() || '';
  const title  = entity.title || entity.username || rawLink;
  const fullId = gId.startsWith('-') ? gId : `-100${gId}`;

  const res = addGroup({ id: fullId, title, link: rawLink });
  return { success: res.success, title, message: res.message };
}

async function reply(client: TelegramClient, toId: string, message: string, markdown = false): Promise<void> {
  try {
    await client.sendMessage(toId, { message, parseMode: markdown ? 'markdown' : undefined });
  } catch (err) {
    logger.error('DM reply xatosi:', err);
  }
}
