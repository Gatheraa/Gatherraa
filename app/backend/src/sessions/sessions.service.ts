import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private redisClient: RedisClientType;

  constructor(private configService: ConfigService) {
    this.redisClient = createClient({
      url: this.configService.get<string>('REDIS_URL'),
    });
    
    this.redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
  }

  async onModuleInit() {
    try {
      await this.redisClient.connect();
      console.log('Redis client connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // In development, we can continue without Redis
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        console.warn('Running without Redis session storage');
      }
    }
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  async createSession(sessionId: string, userId: string, data: any = {}, ttl: number = 86400): Promise<boolean> {
    try {
      const sessionData = {
        userId,
        ...data,
        createdAt: new Date().toISOString(),
      };
      
      await this.redisClient.setEx(
        `session:${sessionId}`,
        ttl,
        JSON.stringify(sessionData),
      );
      
      // Also store session in user's session list
      await this.redisClient.sAdd(`user:sessions:${userId}`, sessionId);
      
      return true;
    } catch (error) {
      console.error('Failed to create session:', error);
      return false;
    }
  }

  async getSession(sessionId: string): Promise<any> {
    try {
      const sessionData = await this.redisClient.get(`session:${sessionId}`);
      if (!sessionData) return null;
      
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, data: any): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;
      
      const updatedSession = {
        ...session,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      await this.redisClient.setEx(
        `session:${sessionId}`,
        86400, // 24 hours
        JSON.stringify(updatedSession),
      );
      
      return true;
    } catch (error) {
      console.error('Failed to update session:', error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        await this.redisClient.sRem(`user:sessions:${session.userId}`, sessionId);
      }
      
      await this.redisClient.del(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const sessionIds = await this.redisClient.sMembers(`user:sessions:${userId}`);
      return sessionIds;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  async invalidateUserSessions(userId: string): Promise<boolean> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      
      // Delete all sessions
      const deletePromises = sessionIds.map(sessionId => 
        this.redisClient.del(`session:${sessionId}`)
      );
      
      await Promise.all(deletePromises);
      
      // Remove session list
      await this.redisClient.del(`user:sessions:${userId}`);
      
      return true;
    } catch (error) {
      console.error('Failed to invalidate user sessions:', error);
      return false;
    }
  }

  async extendSession(sessionId: string, ttl: number = 86400): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;
      
      await this.redisClient.expire(`session:${sessionId}`, ttl);
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      // This is handled automatically by Redis with EXPIRE
      // But we can implement additional cleanup logic if needed
      return 0;
    } catch (error) {
      console.error('Failed to cleanup sessions:', error);
      return 0;
    }
  }
}