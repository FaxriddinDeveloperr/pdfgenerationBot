import { InlineKeyboard } from 'grammy';

// Zayafka uchun inline klaviatura — faqat PDF tugmasi
export function zayafkaKeyboard(orderNumber: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📥 PDF Yuklab olish', `pdf_download:${orderNumber}`);
}

// Admin menyusi
export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Statistika', 'admin_stats')
    .text('👥 Foydalanuvchilar', 'admin_users')
    .row()
    .text('📋 Barcha buyurtmalar', 'admin_orders')
    .text('⚙️ Sozlamalar', 'admin_settings');
}

