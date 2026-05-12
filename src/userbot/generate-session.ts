/**
 * Bu skript bir martalik ishlatiladi.
 * Telegram akkauntingizga kirish uchun Session String yaratadi.
 * Yaratilgan session stringni .env fayliga TELEGRAM_SESSION= ga qo'ying.
 * 
 * Ishlatish: npx ts-node src/userbot/generate-session.ts
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const API_ID = 31714664;
const API_HASH = 'cd6316ae1c5454a30ab2c30ea1c72e10';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔑 Telegram Userbot Session String yaratish\n');
  console.log('Bu skript bir marta ishlatiladi. Keyinchalik .env ga saqlanadi.\n');

  const session = new StringSession('');
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      const phone = await question('📱 Telefon raqamingizni kiriting (+998901234567): ');
      return phone.trim();
    },
    password: async () => {
      const pass = await question('🔐 2FA parolingizni kiriting (bo\'lmasa Enter): ');
      return pass.trim();
    },
    phoneCode: async () => {
      const code = await question('📩 Telegramga kelgan kodni kiriting: ');
      return code.trim();
    },
    onError: (err) => {
      console.error('Xato:', err);
    },
  });

  const sessionString = client.session.save() as unknown as string;
  console.log('\n✅ Muvaffaqiyatli ulandi!\n');
  console.log('👇 Quyidagi session stringni .env fayliga TELEGRAM_SESSION= ga qo\'ying:\n');
  console.log('='.repeat(60));
  console.log(sessionString);
  console.log('='.repeat(60));
  console.log('\n.env fayliga qo\'shish:\nTELEGRAM_SESSION=' + sessionString + '\n');

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch(console.error);
