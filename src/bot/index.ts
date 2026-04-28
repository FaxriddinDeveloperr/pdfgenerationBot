import { Bot, GrammyError, HttpError } from 'grammy';
import { config, validateConfig } from '../config/env';
import { logger } from '../utils/logger';
import { startCommand } from './commands/start';
import { handleGroupMessage } from './handlers/message';
import { handleCallbackQuery } from './handlers/callback';

export function createBot(): Bot {
  validateConfig();

  const bot = new Bot(config.botToken);

  // ===========================
  // KOMANDALAR
  // ===========================
  bot.command('start', startCommand);

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🤖 *Printvoltrabot — Yordam*\n\n` +
      `📋 *Qanday ishlaydi?*\n\n` +
      `1. Bot guruhga qoshiladi\n` +
      `2. Guruhga zakaz xabari keladi\n` +
      `3. Bot xabarni taniydi\n` +
      `4. 📥 PDF tugmasi chiqadi\n` +
      `5. Tugmani bosasiz — PDF tayor!\n\n` +
      `📞 *Muammo bolsa:* Admin bilan boglanang`,
      { parse_mode: 'Markdown' }
    );
  });

  // ===========================
  // XABAR HANDLERLARI
  // ===========================

  // Guruhdan kelgan matnli xabarlar (zayafkalar)
  bot.on('message:text', async (ctx) => {
    const chatType = ctx.chat.type;

    // Guruh xabarlari
    if (chatType === 'group' || chatType === 'supergroup') {
      await handleGroupMessage(ctx);
      return;
    }

    // Private chat
    if (chatType === 'private') {
      await ctx.reply(
        '💡 Bu bot guruhda ishlaydi.\n\nGuruhga zakaz xabari kelganda, men avtomatik *📥 PDF* tugma chiqaraman!',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // ===========================
  // CALLBACK QUERY
  // ===========================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.on('callback_query:data', handleCallbackQuery as any);

  // ===========================
  // XATO HANDLING
  // ===========================
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(`Bot xatosi [update ${ctx.update.update_id}]:`, err.error);

    if (err.error instanceof GrammyError) {
      logger.error('Telegram API xato:', err.error.description);
    } else if (err.error instanceof HttpError) {
      logger.error('HTTP xato:', err.error);
    } else {
      logger.error('Kutilmagan xato:', err.error);
    }
  });

  return bot;
}
