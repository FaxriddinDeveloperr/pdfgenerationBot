import { Context, Filter } from 'grammy';
import { InputFile } from 'grammy';
import { logger } from '../../utils/logger';
import {
  parseZayafkaMessage,
  parseFullZayafkaMessage,
  isZayafkaMessage,
  hasNakladnoyCommand,
} from '../../utils/parser';
import { zayafkaKeyboard } from '../keyboards';
import { generateZayafkaPdf, generateClientPdf, deletePdfFile } from '../../pdf/generator';

// Guruhdan kelgan zayafka xabarlarini ushlash
export async function handleGroupMessage(
  ctx: Filter<Context, 'message:text'>
): Promise<void> {
  const text = ctx.message.text;
  const messageId = ctx.message.message_id;
  const chatId = String(ctx.chat.id);

  // Zayafka xabari emasmi?
  if (!isZayafkaMessage(text)) return;

  logger.info(`📥 Zayafka xabari qabul qilindi: ${text.slice(0, 80)}...`);

  // Buyurtma raqamini topish
  const parsed = parseZayafkaMessage(text, messageId, chatId);
  if (!parsed) {
    logger.warn('Zayafka xabardan buyurtma raqami topilmadi');
    return;
  }

  logger.info(`✅ Buyurtma raqami topildi: ${parsed.orderNumber}`);

  // To'liq parse
  const order = parseFullZayafkaMessage(text);

  // ⭐ Agar xabarda /nakladnoy bo'lsa — AVTOMATIK PDF yuborish
  if (hasNakladnoyCommand(text)) {
    logger.info(`🚀 /nakladnoy topildi — avtomatik PDF yuborilmoqda: ${parsed.orderNumber}`);
    await sendZayafkaPdf(ctx, text, messageId, parsed.orderNumber);
    return;
  }

  // Aks holda — tugma chiqarish
  try {
    const caption =
      `📋 *Zayafka aniqlandi!*\n\n` +
      `🔖 Buyurtma: *#${parsed.orderNumber}*\n` +
      (order ? (
        `👤 Mijoz: ${order.client.name}\n` +
        `📞 Tel: ${order.client.phone}\n` +
        `🏠 Ombor: ${order.warehouse}\n` +
        `📦 Tovarlar: ${order.items.length} xil`
      ) : '') +
      `\n\nPDF ni yuklab olish uchun tugmani bosing:`;

    await ctx.reply(caption, {
      parse_mode: 'Markdown',
      reply_parameters: { message_id: messageId },
      reply_markup: zayafkaKeyboard(parsed.orderNumber),
    });
  } catch (error) {
    logger.error('Guruhga javob berishda xato:', error);
  }
}

// PDF yaratib guruhga yuborish (ikkala variant)
export async function sendZayafkaPdf(
  ctx: Context,
  rawText: string,
  replyToMessageId: number,
  orderNumber: string
): Promise<void> {
  const loadingMsg = await ctx.reply(
    `⏳ *PDF tayyorlanmoqda...*\n📋 Buyurtma: \`${orderNumber}\``,
    {
      parse_mode: 'Markdown',
      reply_parameters: { message_id: replyToMessageId },
    }
  );

  try {
    // Ikkalasini parallel yaratamiz
    const [companyPath, clientPath] = await Promise.all([
      generateZayafkaPdf(rawText),
      generateClientPdf(rawText),
    ]);

    const order = parseFullZayafkaMessage(rawText);
    const caption = order
      ? `👤 Mijoz: ${order.client.name}\n` +
        `🏠 Sklad: ${order.warehouse}\n` +
        `📦 ${order.items.length} xil mahsulot` +
        (order.totalAmount ? `\n💰 Jami: ${order.totalAmount.toLocaleString('ru-RU')} ${order.currency || 'USD'}` : '')
      : `🔖 Buyurtma: #${orderNumber}`;

    // 1. Kompaniya PDF
    await ctx.replyWithDocument(new InputFile(companyPath), {
      caption: `🏢 *Kompaniya nusxasi — №${orderNumber}*\n\n${caption}`,
      parse_mode: 'Markdown',
      reply_parameters: { message_id: replyToMessageId },
    });

    // 2. Mijoz PDF
    await ctx.replyWithDocument(new InputFile(clientPath), {
      caption: `👤 *Mijoz nusxasi — №${orderNumber}*\n\n${caption}`,
      parse_mode: 'Markdown',
      reply_parameters: { message_id: replyToMessageId },
    });

    await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);

    // Fayllarni o'chirish
    await Promise.all([deletePdfFile(companyPath), deletePdfFile(clientPath)]);

    logger.info(`✅ Ikki PDF yuborildi: ${orderNumber}`);
  } catch (error) {
    logger.error(`PDF xato [${orderNumber}]:`, error);
    await ctx.api
      .editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `❌ *PDF yaratib bolmadi\\!*\n\nAdmin bilan boglanang\\.`,
        { parse_mode: 'MarkdownV2' }
      )
      .catch(() => {});
  }
}
