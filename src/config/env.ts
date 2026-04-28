import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Bot
  botToken: process.env.BOT_TOKEN || '',
  groupChatId: process.env.GROUP_CHAT_ID || '',
  adminIds: (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()),

  // ERP
  erp: {
    apiUrl: process.env.ERP_API_URL || '',
    apiToken: process.env.ERP_API_TOKEN || '',
    apiSecret: process.env.ERP_API_SECRET || '',
  },

  // Yandex
  yandex: {
    apiUrl: process.env.YANDEX_API_URL || 'https://b2b.taxi.yandex.net/b2b/cargo/integration/v2',
    oauthToken: process.env.YANDEX_OAUTH_TOKEN || '',
    clientId: process.env.YANDEX_CLIENT_ID || '',
  },

  // Company
  company: {
    name: process.env.COMPANY_NAME || 'VOLTRA ENERGY',
    address: process.env.COMPANY_ADDRESS || 'Toshkent, O\'zbekiston',
    phone: process.env.COMPANY_PHONE || '+998 99 998 24 69',
    phone2: process.env.COMPANY_PHONE2 || '+998 93 705 74 77',
    email: process.env.COMPANY_EMAIL || 'info@voltraenergy.uz',
    website: process.env.COMPANY_WEBSITE || 'https://voltraenergy.uz',
    inn: process.env.COMPANY_INN || '',
  },

  // PDF
  pdf: {
    outputDir: process.env.PDF_OUTPUT_DIR || './temp/pdfs',
    logoPath: process.env.LOGO_PATH || './assets/voltra icon.png',
  },

  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

// Tekshirish
export function validateConfig(): void {
  const required = ['BOT_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`❌ Kerakli muhit o'zgaruvchilari topilmadi: ${missing.join(', ')}`);
  }
}
