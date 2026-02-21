import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';

interface PushNotificationOptions {
  title: string;
  body: string;
  deviceTokens: string[];
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  color?: string;
  clickAction?: string;
}

@Injectable()
export class PushNotificationProvider {
  private readonly logger = new Logger(PushNotificationProvider.name);
  private messaging: any;
  private initialized = false;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const credentialsPath = this.configService.get('FIREBASE_CREDENTIALS_PATH');
      const projectId = this.configService.get('FIREBASE_PROJECT_ID');

      if (!admin.apps.length) {
        if (credentialsPath) {
          // Initialize with credentials file
          const serviceAccount = require(credentialsPath);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId || serviceAccount.project_id,
          });
        } else {
          // Initialize with environment variables
          const credentials = this.configService.get('FIREBASE_CREDENTIALS');
          if (credentials) {
            const serviceAccount = JSON.parse(credentials);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: projectId || serviceAccount.project_id,
            });
          } else {
            this.logger.warn('Firebase credentials not configured');
            return;
          }
        }
      }

      this.messaging = getMessaging(admin.app());
      this.initialized = true;
      this.logger.log('Firebase Messaging initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  /**
   * Send push notification to device
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<string[]> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return [];
    }

    try {
      const validTokens = options.deviceTokens.filter((token) => token && token.length > 0);

      if (validTokens.length === 0) {
        this.logger.warn('No valid device tokens provided');
        return [];
      }

      const message: MulticastMessage = {
        tokens: validTokens,
        notification: {
          title: options.title,
          body: options.body,
        },
        data: options.data,
        android: {
          priority: 'high',
          notification: {
            sound: options.sound || 'default',
            color: options.color || '#FF6B6B',
            clickAction: options.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              sound: options.sound || 'default',
              badge: options.badge,
            },
          },
        },
        webpush: {
          notification: {
            title: options.title,
            body: options.body,
            icon: this.configService.get('PUSH_ICON_URL') || 'https://via.placeholder.com/192',
            click_action: options.clickAction,
          },
          data: options.data,
        },
      };

      const response = await this.messaging.sendMulticast(message);

      this.logger.log(`Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(validTokens[idx]);
            this.logger.warn(`Failed to send to token ${validTokens[idx]}: ${resp.error?.message}`);
          }
        });
      }

      return validTokens;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      throw new Error(`Push notification delivery failed: ${error.message}`);
    }
  }

  /**
   * Send push notification to single device
   */
  async sendPushNotificationToDevice(deviceToken: string, options: Omit<PushNotificationOptions, 'deviceTokens'>): Promise<string> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return '';
    }

    try {
      const message: Message = {
        token: deviceToken,
        notification: {
          title: options.title,
          body: options.body,
        },
        data: options.data,
        android: {
          priority: 'high',
          notification: {
            sound: options.sound || 'default',
            color: options.color || '#FF6B6B',
            clickAction: options.clickAction,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              sound: options.sound || 'default',
              badge: options.badge,
            },
          },
        },
        webpush: {
          notification: {
            title: options.title,
            body: options.body,
            icon: this.configService.get('PUSH_ICON_URL') || 'https://via.placeholder.com/192',
            click_action: options.clickAction,
          },
          data: options.data,
        },
      };

      const messageId = await this.messaging.send(message);
      this.logger.log(`Push notification sent with message ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to send push notification to device: ${error.message}`);
      throw new Error(`Push notification delivery failed: ${error.message}`);
    }
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(deviceTokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized, skipping topic subscription');
      return;
    }

    try {
      const validTokens = deviceTokens.filter((token) => token && token.length > 0);
      if (validTokens.length > 0) {
        await this.messaging.subscribeToTopic(validTokens, topic);
        this.logger.log(`${validTokens.length} devices subscribed to topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic: ${error.message}`);
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(deviceTokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized, skipping topic unsubscription');
      return;
    }

    try {
      const validTokens = deviceTokens.filter((token) => token && token.length > 0);
      if (validTokens.length > 0) {
        await this.messaging.unsubscribeFromTopic(validTokens, topic);
        this.logger.log(`${validTokens.length} devices unsubscribed from topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic: ${error.message}`);
    }
  }

  /**
   * Health check for Firebase
   */
  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Try to send to a test topic
      await this.messaging.send({
        topic: 'health_check',
        notification: {
          title: 'Health Check',
          body: 'Firebase is operational',
        },
      });
      return true;
    } catch (error) {
      this.logger.error(`Push notification health check failed: ${error.message}`);
      return false;
    }
  }
}
