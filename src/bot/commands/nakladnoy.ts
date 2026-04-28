import { CommandContext, Context } from 'grammy';
import { InputFile } from 'grammy';
import { logger } from '../../utils/logger';
import { erpClient } from '../../erp/client';
import { generateNakladnoy, deletePdfFile } from '../../pdf/generator';

export async function nakladnoyCommand(ctx: CommandContext<Context>): Promise<void> {
  // /nakladnoy SH-11965 yoki faqat /nakladnoy
  const args = ctx.match?.trim();
  
  if (!args) {
    await ctx.reply(
      '📄 *Nakladnoy yaratish*\n\n' +
      'Buyurtma raqamini kiriting:\n' +
      '`/nakladnoy SH-11965`\n\n' +
      'Yoki guruhda zayafka xabarini yuborish orqali ham ishlataverasan! 👆',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const orderNumber = args.toUpperCase().replace(/^#/, '');
  await processNakladnoy(ctx, orderNumber, false);
}

// Nakladnoy PDF generatsiya qilish va yuborish
export async function processNakladnoy(
  ctx: Context,
  orderNumber: string,
  showPrices: boolean,
  yandexInfo?: { price: number; eta: string; trackingUrl?: string; currency?: string },
  replyToMessageId?: number
): Promise<void> {
  const loadingMsg = await ctx.reply(
    `⏳ *Nakladnoy tayyorlanmoqda...*\n📋 Buyurtma: \`${orderNumber}\``,
    { parse_mode: 'Markdown', reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined }
  );

  try {
    // ERP dan buyurtmani olish
    logger.info(`Nakladnoy so'raldi: ${orderNumber}`);
    const order = await erpClient.getOrderByNumber(orderNumber);

    if (!order) {
      await ctx.api.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `❌ *Buyurtma topilmadi:* \`${orderNumber}\`\n\nERP tizimida bunday buyurtma yo'q.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // PDF yaratish
    const pdfPath = await generateNakladnoy(order, { showPrices, yandexInfo });

    // PDF yuborish
    await ctx.replyWithDocument(
      new InputFile(pdfPath),
      {
        caption:
          `📄 *Nakladnoy — №${order.orderNumber}*\n\n` +
          `👤 Mijoz: ${order.client.name}\n` +
          `📦 Tovarlar: ${order.items.length} xil, ${order.items.reduce((s, i) => s + i.quantity, 0)} dona\n` +
          `🏠 Ombor: ${order.warehouse}\n` +
          `📅 Sana: ${order.date}`,
        parse_mode: 'Markdown',
        reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
      }
    );

    // Loading xabarni o'chirish
    await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);

    // Temp PDF faylni o'chirish
    await deletePdfFile(pdfPath);

    logger.info(`✅ Nakladnoy yuborildi: ${orderNumber}`);

  } catch (error) {
    logger.error(`Nakladnoy xato [${orderNumber}]:`, error);
    await ctx.api.editMessageText(
      loadingMsg.chat.id,
      loadingMsg.message_id,
      `❌ *Xato yuz berdi!*\n\nNakladnoy yaratib bo'lmadi. Admin bilan bog'laning.`,
      { parse_mode: 'Markdown' }
    );
  }
}
