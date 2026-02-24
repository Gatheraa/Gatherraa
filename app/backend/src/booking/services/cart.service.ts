import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

const CART_TTL = 900; // 15 minutes
const CART_PREFIX = 'cart:';

export interface CartData {
    userId: string;
    eventId: string;
    seatIds: string[];
    createdAt: string;
}

@Injectable()
export class CartService implements OnModuleInit, OnModuleDestroy {
    private redisClient: RedisClientType;

    constructor(private configService: ConfigService) {
        this.redisClient = createClient({
            url: this.configService.get<string>('REDIS_URL'),
        });

        this.redisClient.on('error', (err) => {
            console.error('Booking CartService Redis Error:', err);
        });
    }

    async onModuleInit() {
        try {
            await this.redisClient.connect();
        } catch (error) {
            console.error('CartService failed to connect to Redis:', error);
        }
    }

    async onModuleDestroy() {
        await this.redisClient.quit();
    }

    private cartKey(userId: string, eventId: string): string {
        return `${CART_PREFIX}${userId}:${eventId}`;
    }

    async getCart(userId: string, eventId: string): Promise<CartData | null> {
        const key = this.cartKey(userId, eventId);
        const data = await this.redisClient.get(key);
        if (!data) return null;
        return JSON.parse(data);
    }

    async setCart(userId: string, eventId: string, seatIds: string[]): Promise<CartData> {
        const key = this.cartKey(userId, eventId);
        const cart: CartData = {
            userId,
            eventId,
            seatIds,
            createdAt: new Date().toISOString(),
        };

        await this.redisClient.setEx(key, CART_TTL, JSON.stringify(cart));
        return cart;
    }

    async addToCart(userId: string, eventId: string, seatIds: string[]): Promise<CartData> {
        const existing = await this.getCart(userId, eventId);
        const currentSeats = existing ? existing.seatIds : [];
        const merged = [...new Set([...currentSeats, ...seatIds])];
        return this.setCart(userId, eventId, merged);
    }

    async removeFromCart(userId: string, eventId: string, seatIds: string[]): Promise<CartData> {
        const existing = await this.getCart(userId, eventId);
        if (!existing) {
            return this.setCart(userId, eventId, []);
        }
        const filtered = existing.seatIds.filter((id) => !seatIds.includes(id));
        return this.setCart(userId, eventId, filtered);
    }

    async clearCart(userId: string, eventId: string): Promise<void> {
        const key = this.cartKey(userId, eventId);
        await this.redisClient.del(key);
    }

    async getCartTTL(userId: string, eventId: string): Promise<number> {
        const key = this.cartKey(userId, eventId);
        return this.redisClient.ttl(key);
    }
}
