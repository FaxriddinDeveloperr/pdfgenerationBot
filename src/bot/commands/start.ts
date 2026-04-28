import { CommandContext, Context } from 'grammy';
import { logger } from '../../utils/logger';
import { adminMenuKeyboard } from '../keyboards';
import { config } from '../../config/env';

export async function startCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = String(ctx.from?.id || '');
  const firstName = ctx.from?.first_name || 'Foydalanuvchi';
  const isAdmin = config.adminIds.includes(userId);

  logger.info(`/start komandasi: ${firstName} (${userId})`);

  const welcomeMessage =
`👋 *Salom, ${firstName}!*

🤖 *Printvoltrabot* — ERP zayafka hujjat generatori

━━━━━━━━━━━━━━━━━━━━
📌 *Nima qila olaman?*

📄 *Nakladnoy* — Yuk xati PDF yarataman
🛡 *Kafolat* — Kafolat hujjati PDF yarataman

━━━━━━━━━━━━━━━━━━━━
📋 *Komandalar:*

/nakladnoy — Nakladnoy yaratish
/garant — Kafolat hujjati yaratish
/help — Yordam

━━━━━━━━━━━━━━━━━━━━
💡 *Avtomatik:*
Guruhga zayafka xabari kelganida, bot avtomatik PDF tugmalar qoshadi`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: isAdmin ? adminMenuKeyboard() : undefined,
  });
}
