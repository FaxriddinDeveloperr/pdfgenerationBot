import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram/tl';
import { logger } from '../utils/logger';
import {
  addGroup,
  removeGroup,
  listGroups,
  saveAd,
  getAdInfo,
  addTime,
  removeTime,
  listTimes,
  getStatus,
  sendBroadcast,
  restartScheduler,
  readConfig,
} from './broadcast';

// ============================================================
// Kutish holati — /setad bosilgandan keyin keyingi xabar reklama
// ============================================================
let waitingForAd = false;

// ============================================================
// DM handler — faqat egasi yuborgan buyruqlarni ishlaydi
// ============================================================
export async function startDmHandler(client: TelegramClient): Promise<void> {
  const ownerId = process.env.BROADCAST_OWNER_ID || readConfig().ownerId;

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;
      if (!message) return;

      // Faqat shaxsiy xabarlar (guruh emas)
      const isPrivate = message.isPrivate;
      if (!isPrivate) return;

      // Faqat egasidan
      const senderId = message.senderId?.toString();
      if (senderId !== ownerId) return;

      const text = message.text || '';

      // --------------------------------------------------------
      // REJIM: /setad kutilmoqda — keyingi xabar reklama bo'ladi
      // --------------------------------------------------------
      if (waitingForAd) {
        waitingForAd = false;

        const msgId  = message.id;
        const chatId = senderId;  // DM chat eganing o'zi

        // Media turini aniqlash
        let mediaType = 'text';
        if (message.photo)       mediaType = 'photo';
        else if (message.video)  mediaType = 'video';
        else if (message.voice)  mediaType = 'voice';
        else if (message.videoNote) mediaType = 'video_note';
        else if (message.document)  mediaType = 'document';

        saveAd(msgId, chatId, mediaType);
        logger.info(`📢 Reklama saqlandi: type=${mediaType}, msgId=${msgId}`);

        await client.sendMessage(senderId, {
          message: `✅ Reklama saqlandi!\n\nTur: *${mediaType}*\nXabar ID: \`${msgId}\`\n\n/sendnow bilan hoziroq yuborib ko'ring!`,
          parseMode: 'markdown',
          replyTo: msgId,
        });
        return;
      }

      // --------------------------------------------------------
      // Matn buyruqlarini parse qilish
      // --------------------------------------------------------
      const cmd = text.trim().split(' ')[0].toLowerCase();
      const args = text.trim().slice(cmd.length).trim();

      switch (cmd) {

        // ── GURUH QO'SHISH (avtomatik qo'shilish bilan) ────
        case '/addgroup': {
          if (!args) {
            await reply(client, ownerId,
              '❌ Guruh linkini kiriting.\nMasalan:\n' +
              '/addgroup https://t.me/mygroupname\n' +
              '/addgroup https://t.me/+InviteHash'
            );
            return;
          }

          await reply(client, ownerId, '⏳ Guruhga qo\'shilmoqda...');

          try {
            const rawLink = args.trim();
            const link = rawLink.replace('https://', '').replace('http://', '').trim();

            let entity: any;

            // Maxfiy (invite) link: t.me/+XYZ yoki t.me/joinchat/XYZ
            const isInvite = link.includes('/+') || link.includes('joinchat/');

            if (isInvite) {
              // Invite hash ajratib olish
              const hash = link.split('/+').pop()?.split('/joinchat/').pop() || link;
              try {
                // Guruhga qo'shilish
                await client.invoke(new Api.messages.ImportChatInvite({ hash }));
                logger.info(`✅ Invite link orqali qo'shildi: ${hash}`);
              } catch (joinErr: any) {
                // Already in chat — xato emas
                if (!joinErr?.message?.includes('ALREADY')) {
                  throw joinErr;
                }
              }
              // Entity olish
              entity = await client.getEntity(link).catch(async () => {
                // Ba'zan to'g'ri olishga vaqt kerak
                await new Promise(r => setTimeout(r, 2000));
                return await client.getEntity(hash);
              });
            } else {
              // Ochiq guruh/kanal: @username yoki t.me/username
              const username = link.replace('t.me/', '').split('/')[0];
              try {
                await client.invoke(new Api.channels.JoinChannel({
                  channel: username,
                }));
                logger.info(`✅ Ochiq guruhga qo'shildi: ${username}`);
              } catch (joinErr: any) {
                if (!joinErr?.message?.includes('ALREADY')) {
                  throw joinErr;
                }
              }
              entity = await client.getEntity(username);
            }

            const groupId    = entity.id?.toString() || '';
            const groupTitle = entity.title || entity.username || rawLink;
            const fullId     = groupId.startsWith('-') ? groupId : `-100${groupId}`;

            const result = addGroup({ id: fullId, title: groupTitle, link: rawLink });
            await reply(client, ownerId,
              `✅ Muvaffaqiyatli!\n\n` +
              `👥 Guruh: *${groupTitle}*\n` +
              `🆔 ID: \`${fullId}\`\n\n` +
              (result.success ? '💾 Ro\'yxatga saqlandi.' : result.message),
              true
            );
          } catch (err: any) {
            logger.error('addgroup xato:', err);
            const msg = err?.message || String(err);
            await reply(client, ownerId,
              `❌ Guruhga qo'shilishda xato:\n${msg}\n\n` +
              `Tekshiring:\n` +
              `• Guruh public bo'lsa: /addgroup https://t.me/username\n` +
              `• Guruh private bo'lsa: /addgroup https://t.me/+InviteHash`
            );
          }
          break;
        }

        // ── GURUH O'CHIRISH ─────────────────────────────────
        case '/removegroup': {
          const num = parseInt(args);
          if (isNaN(num)) {
            await reply(client, ownerId, '❌ Raqam kiriting.\nMasalan: /removegroup 1');
            return;
          }
          const result = removeGroup(num);
          await reply(client, ownerId, result.message);
          break;
        }

        // ── GURUHLAR RO'YXATI ───────────────────────────────
        case '/listgroups': {
          await reply(client, ownerId, listGroups());
          break;
        }

        // ── REKLAMA O'RNATISH ───────────────────────────────
        case '/setad': {
          waitingForAd = true;
          await reply(client, ownerId,
            '📢 Reklama xabarini yuboring!\n\n' +
            'Quyidagi turlardan birini yuborishingiz mumkin:\n' +
            '• Matn\n• Rasm + caption\n• Video + caption\n• Ovozli xabar\n• Doiraviy video\n\n' +
            '⚠️ Bekor qilish uchun /cancelad yuboring.'
          );
          break;
        }

        // ── REKLAMANI BEKOR QILISH ──────────────────────────
        case '/cancelad': {
          waitingForAd = false;
          await reply(client, ownerId, '✅ Reklama o\'rnatish bekor qilindi.');
          break;
        }

        // ── REKLAMANI KO'RISH ───────────────────────────────
        case '/showad': {
          const config = readConfig();
          if (!config.adMessageId || !config.adChatId) {
            await reply(client, ownerId, '📭 Reklama o\'rnatilmagan.');
            return;
          }
          // Reklamani egaga forward qilib ko'rsatish
          try {
            await client.forwardMessages(ownerId, {
              messages: [config.adMessageId],
              fromPeer: config.adChatId,
            });
            await reply(client, ownerId, `ℹ️ Yuqoridagi xabar — hozirgi reklama.\nTur: ${config.adMediaType}`);
          } catch {
            await reply(client, ownerId, getAdInfo());
          }
          break;
        }

        // ── VAQT QO'SHISH ───────────────────────────────────
        case '/addtime': {
          if (!args) {
            await reply(client, ownerId, '❌ Vaqtni kiriting.\nMasalan: /addtime 09:10');
            return;
          }
          const result = addTime(args.trim());
          await reply(client, ownerId, result.message);
          if (result.success) {
            restartScheduler(client);
            await reply(client, ownerId, '🔄 Scheduler yangilandi.');
          }
          break;
        }

        // ── VAQT O'CHIRISH ──────────────────────────────────
        case '/removetime': {
          if (!args) {
            await reply(client, ownerId, '❌ Vaqtni kiriting.\nMasalan: /removetime 14:00');
            return;
          }
          const result = removeTime(args.trim());
          await reply(client, ownerId, result.message);
          if (result.success) {
            restartScheduler(client);
            await reply(client, ownerId, '🔄 Scheduler yangilandi.');
          }
          break;
        }

        // ── VAQTLAR RO'YXATI ────────────────────────────────
        case '/listtimes': {
          await reply(client, ownerId, listTimes());
          break;
        }

        // ── HOZIROQ YUBORISH ────────────────────────────────
        case '/sendnow': {
          const config = readConfig();
          if (!config.adMessageId) {
            await reply(client, ownerId, '❌ Avval reklama o\'rnating: /setad');
            return;
          }
          if (config.groups.length === 0) {
            await reply(client, ownerId, '❌ Avval guruh qo\'shing: /addgroup <link>');
            return;
          }
          await reply(client, ownerId, `⏳ ${config.groups.length} ta guruhga yuborilmoqda...`);
          await sendBroadcast(client);
          await reply(client, ownerId, '✅ Yuborish yakunlandi! Loglarni tekshiring.');
          break;
        }

        // ── STATUS ──────────────────────────────────────────
        case '/status': {
          await reply(client, ownerId, getStatus(), true);
          break;
        }

        // ── YORDAM ──────────────────────────────────────────
        case '/help':
        case '/start': {
          await reply(client, ownerId,
            '👋 Broadcast boshqaruv paneli\n\n' +
            '/status — umumiy holat\n' +
            '/addgroup <link> — guruh qo\'shish\n' +
            '/removegroup <N> — guruh o\'chirish\n' +
            '/listgroups — guruhlar ro\'yxati\n' +
            '/setad — reklama o\'rnatish\n' +
            '/showad — reklamani ko\'rish\n' +
            '/addtime HH:MM — vaqt qo\'shish\n' +
            '/removetime HH:MM — vaqt o\'chirish\n' +
            '/listtimes — vaqtlar ro\'yxati\n' +
            '/sendnow — hoziroq yuborish',
            true
          );
          break;
        }

        default: {
          // Buyruq emas, oddiy xabar — e'tiborsiz qoldirish
          break;
        }
      }
    } catch (err) {
      logger.error('DM handler xatosi:', err);
    }
  }, new NewMessage({ incoming: true }));

  logger.info(`✅ DM handler ishga tushdi (egasi: ${ownerId})`);
}

// ============================================================
// Yordamchi — xabar yuborish
// ============================================================
async function reply(
  client: TelegramClient,
  toId: string,
  message: string,
  markdown = false
): Promise<void> {
  try {
    await client.sendMessage(toId, {
      message,
      parseMode: markdown ? 'markdown' : undefined,
    });
  } catch (err) {
    logger.error('DM javob yuborishda xato:', err);
  }
}
