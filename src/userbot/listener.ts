import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { logger } from '../utils/logger';
import { isZayafkaMessage, parseZayafkaMessage, parseFullZayafkaMessage, isMoneyTransfer, parseMoneyTransfer } from '../utils/parser';
import { generateZayafkaPdf, generateClientPdf, generateTransferPdf, deletePdfFile } from '../pdf/generator';
import { Bot } from 'grammy';

let gramMyBot: Bot | null = null;

export function setGrammyBot(bot: Bot) {
  gramMyBot = bot;
}

export async function startUserbotListeners(client: TelegramClient): Promise<void> {
  const watchGroups = (process.env.WATCH_GROUP_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  logger.info(`👀 Userbot kuzatayotgan guruhlar: ${watchGroups.length > 0 ? watchGroups.join(', ') : 'HAMMASI'}`);

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;
      if (!message || !message.text) return;

      const text = message.text;
      const chatId = message.chatId?.toString() || '';
      const messageId = message.id;
      const senderId = message.senderId?.toString() || '';

      // O'zimizning Grammy botimizning xabarini e'tiborsiz qoldirish
      const ourBotId = process.env.BOT_TOKEN?.split(':')[0];
      if (senderId === ourBotId) return;

      // Faqat kerakli guruhlarni kuzatish
      if (watchGroups.length > 0 && !watchGroups.includes(chatId) && !watchGroups.includes('-' + chatId)) {
        return;
      }

      // 1. Pul o'tkazmasi xabari?
      if (isMoneyTransfer(text)) {
        logger.info(`💰 Userbot pul o'tkazmasi xabarini ko'rdi (guruh: ${chatId})`);
        const transfer = parseMoneyTransfer(text);
        if (transfer) {
          await sendTransferPdf(client, chatId, messageId, transfer);
        }
        return;
      }

      // 2. Zayafka xabari?
      if (!isZayafkaMessage(text)) return;

      logger.info(`🤖 Userbot zayafka xabarini ko'rdi (guruh: ${chatId}): ${text.slice(0, 60)}...`);

      const parsed = parseZayafkaMessage(text, messageId, chatId);
      if (!parsed) {
        logger.warn('Userbot: buyurtma raqami topilmadi');
        return;
      }

      logger.info(`✅ Userbot buyurtma raqamini topdi: ${parsed.orderNumber}`);
      await sendPdfToGroup(client, chatId, messageId, text, parsed.orderNumber);

    } catch (err) {
      logger.error('Userbot xabarlari boshqarishda xato:', err);
    }
  }, new NewMessage({}));

  logger.info('✅ Userbot xabarlarni tinglash boshladi');
}

async function sendTransferPdf(
  client: TelegramClient,
  chatId: string,
  replyToMsgId: number,
  transfer: import('../types/erp.types').MoneyTransfer
): Promise<void> {
  const loadingMsg = await client.sendMessage(chatId, {
    message: `⏳ Pul o'tkazmasi PDF tayyorlanmoqda...`,
    replyTo: replyToMsgId,
  });

  try {
    const pdfPath = await generateTransferPdf(transfer);

    await client.sendFile(chatId, {
      file: pdfPath,
      caption: `💰 Pul o'tkazmasi\n📤 ${transfer.fromAccount}\n📥 ${transfer.toAccount}\n💵 ${Number(transfer.fromAmount).toLocaleString('ru-RU')} ${transfer.fromCurrency}`,
      replyTo: replyToMsgId,
    });

    await client.deleteMessages(chatId, [loadingMsg.id], { revoke: true });
    await deletePdfFile(pdfPath);

    logger.info(`✅ Transfer PDF yuborildi`);
  } catch (error) {
    logger.error('❌ Transfer PDF xatosi:', error);
    await client.editMessage(chatId, {
      message: loadingMsg.id,
      text: `❌ PDF yaratib bolmadi!\n\nAdmin bilan boglanang.`,
    }).catch(() => {});
  }
}

async function sendPdfToGroup(
  client: TelegramClient,
  chatId: string,
  replyToMsgId: number,
  rawText: string,
  orderNumber: string
): Promise<void> {
  // "Tayyorlanmoqda" xabari yuborish
  const loadingMsg = await client.sendMessage(chatId, {
    message: `⏳ PDF tayyorlanmoqda...\n📋 Buyurtma: ${orderNumber}`,
    replyTo: replyToMsgId,
  });

  try {
    const [companyPath, clientPath] = await Promise.all([
      generateZayafkaPdf(rawText),
      generateClientPdf(rawText),
    ]);

    const order = parseFullZayafkaMessage(rawText);
    const caption = order
      ? `👤 Mijoz: ${order.client.name}\n🏠 Sklad: ${order.warehouse}\n📦 ${order.items.length} xil mahsulot` +
        (order.totalAmount ? `\n💰 Jami: ${order.totalAmount.toLocaleString('ru-RU')} ${order.currency || 'UZS'}` : '')
      : `🔖 Buyurtma: #${orderNumber}`;

    // Kompaniya PDF
    await client.sendFile(chatId, {
      file: companyPath,
      caption: `🏢 Kompaniya nusxasi — №${orderNumber}\n\n${caption}`,
      replyTo: replyToMsgId,
    });

    // Mijoz PDF
    await client.sendFile(chatId, {
      file: clientPath,
      caption: `👤 Mijoz nusxasi — №${orderNumber}\n\n${caption}`,
      replyTo: replyToMsgId,
    });

    // "Tayyorlanmoqda" xabarini o'chirish
    await client.deleteMessages(chatId, [loadingMsg.id], { revoke: true });

    // Vaqtinchalik fayllarni o'chirish
    await Promise.all([deletePdfFile(companyPath), deletePdfFile(clientPath)]);

    logger.info(`✅ Userbot PDF yubordi: ${orderNumber}`);
  } catch (error) {
    logger.error(`❌ Userbot PDF xatosi [${orderNumber}]:`, error);
    await client.editMessage(chatId, {
      message: loadingMsg.id,
      text: `❌ PDF yaratib bolmadi!\n\nAdmin bilan boglanang.`,
    }).catch(() => {});
  }
}
