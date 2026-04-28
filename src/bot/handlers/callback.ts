import { CallbackQueryContext, Context } from 'grammy';
import { logger } from '../../utils/logger';
import { sendZayafkaPdf } from './message';

export async function handleCallbackQuery(ctx: CallbackQueryContext<Context>): Promise<void> {
  const data = ctx.callbackQuery.data;

  logger.info(`🔘 Callback: ${data} | User: ${ctx.from.id}`);

  const colonIdx = data.indexOf(':');
  if (colonIdx === -1) {
    await ctx.answerCallbackQuery('❌ Noma\'lum amal');
    return;
  }

  const action = data.slice(0, colonIdx);
  const orderNumber = data.slice(colonIdx + 1);

  switch (action) {

    // ------- PDF YUKLAB OLISH -------
    case 'pdf_download': {
      const originalMessage = ctx.callbackQuery.message?.reply_to_message?.text;
      const msgId = ctx.callbackQuery.message?.reply_to_message?.message_id;

      if (!originalMessage || !msgId) {
        await ctx.answerCallbackQuery('❌ Asl xabar topilmadi');
        break;
      }

      await ctx.answerCallbackQuery('⏳ PDF tayyorlanmoqda...');
      await sendZayafkaPdf(ctx, originalMessage, msgId, orderNumber);
      break;
    }

    // ------- CANCEL -------
    case 'cancel':
      await ctx.answerCallbackQuery();
      await ctx.deleteMessage().catch(() => {});
      break;

    default:
      logger.warn(`Noma'lum callback action: ${action}`);
      await ctx.answerCallbackQuery('❌ Noma\'lum amal');
  }
}
