import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { logger } from '../utils/logger';

let client: TelegramClient | null = null;

export function getUserbotClient(): TelegramClient | null {
  return client;
}

export async function startUserbot(): Promise<TelegramClient | null> {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  const sessionString = process.env.TELEGRAM_SESSION || '';

  if (!apiId || !apiHash || !sessionString) {
    logger.warn('⚠️ Userbot sozlamalari topilmadi (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION). Userbot ishga tushmaydi.');
    return null;
  }

  try {
    const session = new StringSession(sessionString);
    client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => '',
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => {
        logger.error('Userbot xatosi:', err);
      },
    });

    logger.info('✅ Userbot muvaffaqiyatli ulandi!');
    return client;
  } catch (error) {
    logger.error('❌ Userbot ishga tushmadi:', error);
    return null;
  }
}

export async function stopUserbot(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
    logger.info('✅ Userbot to\'xtatildi');
  }
}
