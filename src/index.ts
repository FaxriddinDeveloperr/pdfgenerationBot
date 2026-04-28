import 'dotenv/config';
import { createBot } from './bot';
import { logger } from './utils/logger';
import { closeBrowser } from './pdf/generator';
import fs from 'fs';

// Papkalarni yaratish
function ensureDirectories(): void {
  const dirs = ['./temp/pdfs', './logs', './assets'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`📁 Papka yaratildi: ${dir}`);
    }
  });
}

async function main(): Promise<void> {
  logger.info('🚀 Printvoltrabot ishga tushmoqda...');
  logger.info(`📌 Muhit: ${process.env.NODE_ENV || 'development'}`);

  ensureDirectories();

  const bot = createBot();

  // Bot komandalarini Telegram'ga ro'yxatlash (xato bo'lsa o'tkazib yuboradi)
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '🏠 Asosiy menyu' },
      { command: 'help', description: '❓ Yordam' },
    ]);
  } catch {
    logger.warn('⚠️ setMyCommands xato — internet yoq, otkazib yuborildi');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`⚠️ ${signal} signali qabul qilindi. Bot to'xtatilmoqda...`);
    await bot.stop();
    await closeBrowser();
    logger.info('✅ Bot muvaffaqiyatli to\'xtatildi');
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Botni ishga tushirish
  logger.info('🤖 Bot polling rejimida ishlamoqda...');
  await bot.start({
    allowed_updates: ['message', 'callback_query', 'channel_post'],
    onStart: (botInfo) => {
      logger.info(`✅ Bot muvaffaqiyatli ishga tushdi!`);
      logger.info(`👤 Bot: @${botInfo.username} (${botInfo.first_name})`);
    },
  });
}

main().catch((error) => {
  logger.error('❌ Bot ishga tushmadi:', error);
  process.exit(1);
});
