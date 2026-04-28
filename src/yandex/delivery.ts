import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface YandexDeliveryInfo {
  available: boolean;
  price?: number;
  currency?: string;
  eta?: string;           // "45 daqiqa"
  vehicleType?: string;
  orderId?: string;
  trackingUrl?: string;
  status?: string;
}

export class YandexDeliveryClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.yandex.apiUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${config.yandex.oauthToken}`,
        'Accept-Language': 'ru',
        'Content-Type': 'application/json',
      },
    });
  }

  // Yetkazib berish narxi va ma'lumotlarini olish
  async getDeliveryInfo(params: {
    fromAddress: string;  // Ombor manzili
    toAddress: string;    // Mijoz manzili
    weight?: number;      // kg
    dimensions?: { length: number; width: number; height: number };
  }): Promise<YandexDeliveryInfo> {
    
    if (!config.yandex.oauthToken || config.nodeEnv === 'development') {
      logger.warn('⚠️ Yandex API token yo\'q. Mock data qaytarilmoqda');
      return this.getMockDeliveryInfo();
    }

    try {
      // Yandex Delivery narx so'rovi
      const response = await this.client.post('/check-price', {
        items: [{ size: { length: 0.3, width: 0.3, height: 0.3 }, weight: params.weight || 5 }],
        route_points: [
          { address: { fullname: params.fromAddress }, type: 'source' },
          { address: { fullname: params.toAddress }, type: 'destination' },
        ],
        type: 'express',
      });

      return {
        available: true,
        price: response.data.price,
        currency: 'UZS',
        eta: response.data.eta,
        vehicleType: 'auto',
      };
    } catch (error) {
      logger.error('Yandex Delivery xato:', error);
      return this.getMockDeliveryInfo();
    }
  }

  // Mock ma'lumot
  private getMockDeliveryInfo(): YandexDeliveryInfo {
    return {
      available: true,
      price: 45000,
      currency: 'UZS',
      eta: '2-3 kun ichida',
      vehicleType: 'Yuk mashina',
      trackingUrl: 'https://taxi.yandex.com/track/mock',
    };
  }

  // Buyurtma yaratish
  async createDeliveryOrder(params: {
    fromAddress: string;
    toAddress: string;
    clientName: string;
    clientPhone: string;
    comment?: string;
    items: Array<{ name: string; quantity: number }>;
  }): Promise<{ success: boolean; orderId?: string; trackingUrl?: string; error?: string }> {
    
    if (!config.yandex.oauthToken) {
      return {
        success: false,
        error: 'Yandex API token sozlanmagan',
      };
    }

    try {
      const response = await this.client.post('/claims/create', {
        items: params.items.map(item => ({
          title: item.name,
          quantity: { value: item.quantity, unit: 'шт' },
          cost_value: '0',
          cost_currency: 'UZS',
        })),
        route_points: [
          {
            address: { fullname: params.fromAddress },
            contact: { name: 'Ibox Ombor', phone: config.company.phone },
            type: 'source',
            point_id: 1,
          },
          {
            address: { fullname: params.toAddress },
            contact: { name: params.clientName, phone: params.clientPhone },
            type: 'destination',
            point_id: 2,
          },
        ],
        comment: params.comment || '',
      });

      return {
        success: true,
        orderId: response.data.id,
        trackingUrl: `https://taxi.yandex.com/track/${response.data.id}`,
      };
    } catch (error) {
      logger.error('Yandex order yaratishda xato:', error);
      return { success: false, error: 'Yandex buyurtma yaratib bo\'lmadi' };
    }
  }
}

export const yandexClient = new YandexDeliveryClient();
