import { CommandContext, Context, InputFile } from 'grammy';
import { logger } from '../../utils/logger';
import { erpClient } from '../../erp/client';
import { generateGarant, deletePdfFile } from '../../pdf/generator';

export async function garantCommand(ctx: CommandContext<Context>): Promise<void> {
  const args = ctx.match?.trim();

  if (!args) {
    await ctx.reply(
      '🛡 *Kafolat hujjati yaratish*\n\n' +
      'Buyurtma raqamini kiriting:\n' +
      '`/garant SH-11965`\n\n' +
      'Yoki guruhda kafolat tugmasini bosing!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const orderNumber = args.toUpperCase().replace(/^#/, '');
  await processGarant(ctx, orderNumber);
}

// Garant PDF generatsiya qilish va yuborish
export async function processGarant(
  ctx: Context,
  orderNumber: string,
  replyToMessageId?: number
): Promise<void> {
  const loadingMsg = await ctx.reply(
    `⏳ *Kafolat hujjati tayyorlanmoqda...*\n🛡 Buyurtma: \`${orderNumber}\``,
    { parse_mode: 'Markdown', reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined }
  );

  try {
    logger.info(`Garant so'raldi: ${orderNumber}`);
    const order = await erpClient.getOrderByNumber(orderNumber);

    if (!order) {
      await ctx.api.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `❌ *Buyurtma topilmadi:* \`${orderNumber}\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const pdfPath = await generateGarant(order);
    const warrantyMonths = order.items[0]?.warrantyMonths || 24;

    await ctx.replyWithDocument(
      new InputFile(pdfPath),
      {
        caption:
          `🛡 *Kafolat Hujjati — №${order.orderNumber}*\n\n` +
          `👤 Mijoz: ${order.client.name}\n` +
          `📦 Tovarlar: ${order.items.length} xil\n` +
          `⏳ Kafolat muddati: *${warrantyMonths} oy*\n` +
          `📅 Sana: ${order.date}`,
        parse_mode: 'Markdown',
        reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
      }
    );

    await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);
    await deletePdfFile(pdfPath);

    logger.info(`✅ Garant yuborildi: ${orderNumber}`);

  } catch (error) {
    logger.error(`Garant xato [${orderNumber}]:`, error);
    await ctx.api.editMessageText(
      loadingMsg.chat.id,
      loadingMsg.message_id,
      `❌ *Xato yuz berdi!*\n\nKafolat hujjati yaratib bo'lmadi.`,
      { parse_mode: 'Markdown' }
    );
  }
}
