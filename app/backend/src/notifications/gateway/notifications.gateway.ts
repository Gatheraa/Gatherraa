import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn('Connection attempt without token');
        socket.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      socket.userId = decoded.sub || decoded.userId;

      // Store user connection in cache
      await this.cacheManager.set(`user_socket_${socket.userId}`, socket.id, 3600 * 24 * 7); // 7 days

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);
      socket.join(`user_notifications_${socket.userId}`);

      this.logger.log(`User ${socket.userId} connected with socket ${socket.id}`);

      // Notify user of successful connection
      socket.emit('connection_established', {
        message: 'Connected to notification service',
        userId: socket.userId,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      await this.cacheManager.del(`user_socket_${socket.userId}`);
      this.logger.log(`User ${socket.userId} disconnected`);
    }
  }

  /**
   * Subscribe to notification updates for a specific user
   */
  @SubscribeMessage('subscribe_notifications')
  async handleSubscribe(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { userId?: string },
  ) {
    const userId = data.userId || socket.userId;

    if (userId !== socket.userId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    socket.join(`notifications_${userId}`);
    socket.emit('subscribed', { message: `Subscribed to notifications` });
    this.logger.log(`User ${userId} subscribed to notifications`);
  }

  /**
   * Mark notification as read
   */
  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const result = await this.notificationsService.markAsRead(socket.userId, data.notificationId);

      socket.emit('notification_read', {
        notificationId: data.notificationId,
        success: true,
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Mark all notifications as read
   */
  @SubscribeMessage('mark_all_as_read')
  async handleMarkAllAsRead(@ConnectedSocket() socket: AuthenticatedSocket) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      await this.notificationsService.markAllAsRead(socket.userId);

      socket.emit('all_notifications_read', {
        success: true,
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Delete notification
   */
  @SubscribeMessage('delete_notification')
  async handleDeleteNotification(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      await this.notificationsService.deleteNotification(socket.userId, data.notificationId);

      socket.emit('notification_deleted', {
        notificationId: data.notificationId,
        success: true,
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Get unread count
   */
  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() socket: AuthenticatedSocket) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const count = await this.notificationsService.getUnreadCount(socket.userId);

      socket.emit('unread_count', { count });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Emit notification to specific user
   */
  async notifyUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('notification_received', notification);
  }

  /**
   * Emit notification to multiple users
   */
  async notifyUsers(userIds: string[], notification: any) {
    for (const userId of userIds) {
      this.server.to(`user_${userId}`).emit('notification_received', notification);
    }
  }

  /**
   * Broadcast notification to all connected clients
   */
  async broadcastNotification(notification: any) {
    this.server.emit('broadcast_notification', notification);
  }

  /**
   * Send notification to room
   */
  async notifyRoom(room: string, notification: any) {
    this.server.to(room).emit('notification_received', notification);
  }

  /**
   * Get connected users count
   */
  async getConnectedUsersCount(): Promise<number> {
    const sockets = await this.server.fetchSockets();
    return sockets.length;
  }

  /**
   * Get user status (online/offline)
   */
  async getUserStatus(userId: string): Promise<boolean> {
    const connectedUsers = await this.server.in(`user_${userId}`).fetchSockets();
    return connectedUsers.length > 0;
  }
}
