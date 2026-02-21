import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './services/preferences.service';
import { TemplateService } from './services/template.service';
import { AnalyticsService } from './services/analytics.service';
import {
  CreateNotificationDto,
  SendNotificationDto,
  CreateBulkNotificationDto,
  UpdateNotificationPreferencesDto,
  NotificationPaginationDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private preferencesService: PreferencesService,
    private templateService: TemplateService,
    private analyticsService: AnalyticsService,
  ) {}

  /**
   * Get user notifications
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getNotifications(@Req() req, @Query() query: NotificationPaginationDto) {
    const userId = req.user.sub || req.user.userId;
    return this.notificationsService.getNotifications(userId, query);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'))
  async getUnreadCount(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Create notification
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createNotification(@Req() req, @Body() dto: CreateNotificationDto) {
    const userId = req.user.sub || req.user.userId;
    dto.userId = userId;
    return this.notificationsService.createAndSendNotification(dto);
  }

  /**
   * Send bulk notifications (admin only)
   */
  @Post('bulk')
  @UseGuards(AuthGuard('jwt'))
  async sendBulkNotifications(@Body() dto: CreateBulkNotificationDto) {
    return this.notificationsService.sendBulkNotifications(dto);
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  @UseGuards(AuthGuard('jwt'))
  async markAsRead(@Req() req, @Param('id') notificationId: string) {
    const userId = req.user.sub || req.user.userId;
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  /**
   * Mark all as read
   */
  @Put('read/all')
  @UseGuards(AuthGuard('jwt'))
  async markAllAsRead(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    const count = await this.notificationsService.markAllAsRead(userId);
    return { message: `Marked ${count} notifications as read` };
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(204)
  async deleteNotification(@Req() req, @Param('id') notificationId: string) {
    const userId = req.user.sub || req.user.userId;
    await this.notificationsService.deleteNotification(userId, notificationId);
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences/me')
  @UseGuards(AuthGuard('jwt'))
  async getUserPreferences(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.getUserPreferences(userId);
  }

  /**
   * Update user notification preferences
   */
  @Put('preferences/me')
  @UseGuards(AuthGuard('jwt'))
  async updateUserPreferences(@Req() req, @Body() dto: UpdateNotificationPreferencesDto) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.updateUserPreferences(userId, dto);
  }

  /**
   * Add device token for push notifications
   */
  @Post('preferences/device-token')
  @UseGuards(AuthGuard('jwt'))
  async addDeviceToken(@Req() req, @Body() body: { deviceToken: string }) {
    const userId = req.user.sub || req.user.userId;
    if (!body.deviceToken) {
      throw new BadRequestException('Device token is required');
    }
    return this.preferencesService.addDeviceToken(userId, body.deviceToken);
  }

  /**
   * Remove device token
   */
  @Delete('preferences/device-token/:token')
  @UseGuards(AuthGuard('jwt'))
  async removeDeviceToken(@Req() req, @Param('token') deviceToken: string) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.removeDeviceToken(userId, deviceToken);
  }

  /**
   * Unsubscribe from category
   */
  @Post('preferences/unsubscribe/:category')
  @UseGuards(AuthGuard('jwt'))
  async unsubscribeFromCategory(@Req() req, @Param('category') category: string) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.unsubscribeFromCategory(userId, category);
  }

  /**
   * Subscribe to category
   */
  @Post('preferences/subscribe/:category')
  @UseGuards(AuthGuard('jwt'))
  async subscribeToCategory(@Req() req, @Param('category') category: string) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.subscribeToCategory(userId, category);
  }

  /**
   * Unsubscribe from all
   */
  @Post('preferences/unsubscribe-all')
  @UseGuards(AuthGuard('jwt'))
  async unsubscribeFromAll(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    return this.preferencesService.unsubscribeFromAll(userId);
  }

  /**
   * Get notification templates
   */
  @Get('templates')
  async getTemplates() {
    return this.templateService.getAllTemplates();
  }

  /**
   * Create notification template
   */
  @Post('templates')
  @UseGuards(AuthGuard('jwt'))
  async createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.templateService.createTemplate(dto);
  }

  /**
   * Get template by ID
   */
  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    return this.templateService.getTemplateById(id);
  }

  /**
   * Update template
   */
  @Put('templates/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateNotificationTemplateDto) {
    return this.templateService.updateTemplate(id, dto);
  }

  /**
   * Delete template
   */
  @Delete('templates/:id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(204)
  async deleteTemplate(@Param('id') id: string) {
    await this.templateService.deleteTemplate(id);
  }

  /**
   * Get analytics
   */
  @Get('analytics/summary')
  @UseGuards(AuthGuard('jwt'))
  async getAnalyticsSummary(@Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    return this.analyticsService.getSummary(from, to);
  }

  /**
   * Get analytics by category
   */
  @Get('analytics/category')
  @UseGuards(AuthGuard('jwt'))
  async getAnalyticsByCategory(@Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    return this.analyticsService.getCategoryBreakdown(from, to);
  }

  /**
   * Health check
   */
  @Get('health')
  async healthCheck() {
    const healthy = await this.notificationsService.healthCheck();
    return { status: healthy ? 'healthy' : 'unhealthy' };
  }
}
