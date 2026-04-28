import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { ErpOrder } from '../types/erp.types';

export class ErpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.erp.apiUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${config.erp.apiToken}`,
        'X-API-Secret': config.erp.apiSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('ERP API xato:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        throw error;
      }
    );
  }

  // Buyurtmani raqam bo'yicha olish
  async getOrderByNumber(orderNumber: string): Promise<ErpOrder | null> {
    // Agar ERP API yo'q bo'lsa, mock data qayt
    if (!config.erp.apiUrl || config.nodeEnv === 'development') {
      logger.warn(`⚠️ ERP API URL yo'q. Mock data ishlatilmoqda: ${orderNumber}`);
      return this.getMockOrder(orderNumber);
    }

    try {
      const response = await this.client.get(`/orders/${orderNumber}`);
      return this.mapToErpOrder(response.data);
    } catch (error) {
      logger.error(`ERP order olishda xato [${orderNumber}]:`, error);
      // Fallback to mock
      return this.getMockOrder(orderNumber);
    }
  }

  // ERP API javobini standart formatga o'tkazish
  private mapToErpOrder(data: Record<string, unknown>): ErpOrder {
    // Bu qism real ERP API strukturasiga qarab o'zgartiriladi
    return data as unknown as ErpOrder;
  }

  // ===========================
  // MOCK DATA - ERP API bo'lmasa
  // ===========================
  private getMockOrder(orderNumber: string): ErpOrder {
    return {
      id: orderNumber,
      orderNumber: orderNumber,
      status: 'Yangi',
      date: new Date().toLocaleDateString('uz-UZ'),
      
      createdBy: 'Zavqiddin Lutfulloyev',
      createdByRole: 'FES menejer',
      managerId: '001',
      managerName: 'Zavqiddin Lutfulloyev',
      managerRole: 'FES menejer',
      
      client: {
        id: '1302',
        name: 'ZV Jonibek aka shaxrisabz 1302',
        phone: '+998909741302',
        address: 'Shaxrisabz shahri',
      },
      
      warehouse: 'Ark-buloq 4-a dukon',
      
      items: [
        {
          position: 1,
          name: 'Era Solar 625 W',
          quantity: 8,
          unit: 'шт',
          price: 2500000,
          total: 20000000,
          category: 'Quyosh paneli',
          warrantyMonths: 24,
        },
      ],
      
      notes: 'yandeksdan chiqarib berish kerak',
      deliveryType: 'yandex',
      totalAmount: 20000000,
      currency: 'UZS',
    };
  }
}

export const erpClient = new ErpClient();
