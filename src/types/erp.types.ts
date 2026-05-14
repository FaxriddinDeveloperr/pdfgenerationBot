// ERP API dan kelgan buyurtma strukturasi
export interface ErpOrder {
  id: string;
  orderNumber: string;
  status: string;
  date: string;
  createdBy: string;
  createdByRole: string;
  managerId: string;
  managerName: string;
  managerRole: string;
  client: {
    id: string;
    name: string;
    phone: string;
    address?: string;
  };
  warehouse: string;
  items: ErpOrderItem[];
  notes?: string;
  deliveryType?: string;
  totalAmount?: number;
  currency?: string;
}

export interface ErpOrderItem {
  position: number;
  name: string;
  quantity: number;
  unit: string;
  price?: number;
  total?: number;
  category?: string;
  serialNumbers?: string[];
  warrantyMonths?: number;
}

export interface ParsedZayafka {
  orderNumber: string;
  rawMessage: string;
  messageId: number;
  chatId: string;
  fromUserId?: string;
}

// Pul o'tkazmasi strukturasi
export interface MoneyTransfer {
  date: string;
  person: string;
  fromAccount: string;
  fromAmount: string;
  fromCurrency: string;
  toAccount: string;
  toAmount: string;
  toCurrency: string;
  remainingBalance?: string;
  notes?: string;
}
