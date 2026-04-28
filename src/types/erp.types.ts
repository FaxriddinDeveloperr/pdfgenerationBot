// ERP API dan kelgan buyurtma strukturasi
export interface ErpOrder {
  id: string;              // SH-11965
  orderNumber: string;
  status: string;          // Yangi | Jarayonda | Bajarildi
  date: string;            // 25.04.2026
  
  // Xodimlar
  createdBy: string;       // Zavqiddin Lutfulloyev
  createdByRole: string;   // FES menejer
  managerId: string;
  managerName: string;
  managerRole: string;
  
  // Mijoz
  client: {
    id: string;
    name: string;          // ZV Jonibek aka shaxrisabz 1302
    phone: string;         // +998909741302
    address?: string;
  };
  
  // Ombor
  warehouse: string;       // Ark-buloq 4-a dukon
  
  // Tovarlar
  items: ErpOrderItem[];
  
  // Qo'shimcha
  notes?: string;
  deliveryType?: string;   // yandex | pickup | courier
  totalAmount?: number;
  currency?: string;        // UZS | USD | RUB
}


export interface ErpOrderItem {
  position: number;        // #1
  name: string;            // Era Solar 625 W
  quantity: number;        // 8
  unit: string;            // шт
  price?: number;
  total?: number;
  category?: string;
  serialNumbers?: string[];
  warrantyMonths?: number; // Kafolat muddati (oyda)
}

// Parsed zayafka (Telegram xabaridan)
export interface ParsedZayafka {
  orderNumber: string;     // SH-11965
  rawMessage: string;
  messageId: number;
  chatId: string;
  fromUserId?: string;
}
