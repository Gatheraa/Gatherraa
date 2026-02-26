import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiKeyManagementService, CreateApiKeyDto, UpdateApiKeyDto } from '../services/api-key-management.service';
import { AdvancedQuotaService } from '../services/advanced-quota.service';
import { ApiUsageAnalyticsService } from '../services/api-usage-analytics.service';
import { AdvancedDdosService } from '../services/advanced-ddos.service';
import { ApiGatewayService } from '../services/api-gateway.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from '../../auth/guards/api-key-auth.guard';

@Controller('api/v1/rate-limit')
export class RateLimitManagementController {
  constructor(
    private apiKeyService: ApiKeyManagementService,
    private quotaService: AdvancedQuotaService,
    private analyticsService: ApiUsageAnalyticsService,
    private ddosService: AdvancedDdosService,
    private gatewayService: ApiGatewayService,
  ) {}

  // ==================== API KEY MANAGEMENT ====================

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(@Body() createDto: CreateApiKeyDto) {
    const apiKey = await this.apiKeyService.createApiKey(createDto);
    return {
      success: true,
      data: apiKey,
      message: 'API key created successfully'
    };
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async listApiKeys(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('isActive') isActive?: boolean
  ) {
    const result = await this.apiKeyService.listApiKeys(
      undefined, // userId from JWT token
      { page, limit, search, tier, isActive }
    );
    
    return {
      success: true,
      data: result
    };
  }

  @Get('api-keys/:keyId')
  @UseGuards(JwtAuthGuard)
  async getApiKey(@Param('keyId') keyId: string) {
    const result = await this.apiKeyService.getApiKeyWithUsage(keyId);
    return {
      success: true,
      data: result
    };
  }

  @Put('api-keys/:keyId')
  @UseGuards(JwtAuthGuard)
  async updateApiKey(
    @Param('keyId') keyId: string,
    @Body() updateDto: UpdateApiKeyDto
  ) {
    const apiKey = await this.apiKeyService.updateApiKey(keyId, updateDto);
    return {
      success: true,
      data: apiKey,
      message: 'API key updated successfully'
    };
  }

  @Post('api-keys/:keyId/rotate')
  @UseGuards(JwtAuthGuard)
  async rotateApiKey(@Param('keyId') keyId: string) {
    const result = await this.apiKeyService.rotateApiKey(keyId);
    return {
      success: true,
      data: result,
      message: 'API key rotated successfully'
    };
  }

  @Delete('api-keys/:keyId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(
    @Param('keyId') keyId: string,
    @Body('reason') reason: string
  ) {
    await this.apiKeyService.revokeApiKey(keyId, reason || 'User requested');
  }

  // ==================== QUOTA MANAGEMENT ====================

  @Post('quotas')
  @UseGuards(JwtAuthGuard)
  async setQuota(@Body() quotaData: {
    userId: string;
    endpoint: string;
    tier: string;
    period: string;
    limit: number;
    overageRate: number;
  }) {
    const quota = await this.quotaService.setQuota(
      quotaData.userId,
      quotaData.endpoint,
      quotaData.tier as any,
      quotaData.period as any,
      quotaData.limit,
      quotaData.overageRate
    );

    return {
      success: true,
      data: quota,
      message: 'Quota set successfully'
    };
  }

  @Get('quotas/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserQuotas(
    @Param('userId') userId: string,
    @Query('endpoint') endpoint?: string
  ) {
    // This would be implemented in the quota service
    return {
      success: true,
      data: { message: 'Quota retrieval not implemented' }
    };
  }

  @Post('quotas/reset')
  @UseGuards(JwtAuthGuard)
  async resetQuotas() {
    await this.quotaService.resetQuotas();
    return {
      success: true,
      message: 'Quotas reset successfully'
    };
  }

  // ==================== USAGE ANALYTICS ====================

  @Get('analytics/usage')
  @UseGuards(JwtAuthGuard)
  async getUsageAnalytics(
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'day',
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const report = await this.analyticsService.generateUsageReport(
      period,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return {
      success: true,
      data: report
    };
  }

  @Get('analytics/api-keys/:keyId')
  @UseGuards(JwtAuthGuard)
  async getApiKeyAnalytics(
    @Param('keyId') keyId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month'
  ) {
    const analytics = await this.analyticsService.getApiKeyAnalytics(keyId, period);
    return {
      success: true,
      data: analytics
    };
  }

  @Get('analytics/realtime')
  @UseGuards(JwtAuthGuard)
  async getRealTimeAnalytics() {
    const metrics = await this.analyticsService.getRealTimeMetrics();
    return {
      success: true,
      data: metrics
    };
  }

  @Get('analytics/trends')
  @UseGuards(JwtAuthGuard)
  async getUsageTrends(
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
    @Query('userId') userId?: string
  ) {
    const trends = await this.analyticsService.getUsageTrends(period, userId);
    return {
      success: true,
      data: trends
    };
  }

  @Get('analytics/cost')
  @UseGuards(JwtAuthGuard)
  async getCostAnalysis(
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
    @Query('userId') userId?: string
  ) {
    const analysis = await this.analyticsService.getCostAnalysis(period, userId);
    return {
      success: true,
      data: analysis
    };
  }

  @Post('analytics/export')
  @UseGuards(JwtAuthGuard)
  async exportUsageData(@Body() exportRequest: {
    format: 'csv' | 'json' | 'excel';
    filters: {
      startDate?: string;
      endDate?: string;
      userId?: string;
      apiKeyId?: string;
      endpoint?: string;
    };
  }) {
    const exportData = await this.analyticsService.exportUsageData(
      exportRequest.format,
      {
        startDate: exportRequest.filters.startDate ? new Date(exportRequest.filters.startDate) : undefined,
        endDate: exportRequest.filters.endDate ? new Date(exportRequest.filters.endDate) : undefined,
        userId: exportRequest.filters.userId,
        apiKeyId: exportRequest.filters.apiKeyId,
        endpoint: exportRequest.filters.endpoint
      }
    );

    return {
      success: true,
      data: exportData
    };
  }

  // ==================== DDoS PROTECTION ====================

  @Get('ddos/blocked-ips')
  @UseGuards(JwtAuthGuard)
  async getBlockedIps(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('blockType') blockType?: string,
    @Query('isActive') isActive?: boolean
  ) {
    const result = await this.ddosService.getBlockedIps({
      page,
      limit,
      blockType,
      isActive
    });

    return {
      success: true,
      data: result
    };
  }

  @Post('ddos/block-ip')
  @UseGuards(JwtAuthGuard)
  async blockIp(@Body() blockData: {
    ipAddress: string;
    reason?: string;
    duration?: number;
    metadata?: Record<string, any>;
  }) {
    await this.ddosService.blockIp(
      blockData.ipAddress,
      blockData.reason || 'MANUAL',
      blockData.metadata,
      blockData.duration
    );

    return {
      success: true,
      message: 'IP blocked successfully'
    };
  }

  @Delete('ddos/blocked-ips/:ipAddress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockIp(
    @Param('ipAddress') ipAddress: string,
    @Body('unblockedBy') unblockedBy: string
  ) {
    await this.ddosService.unblockIp(ipAddress, unblockedBy);
  }

  @Post('ddos/cleanup')
  @UseGuards(JwtAuthGuard)
  async cleanupExpiredBlocks() {
    await this.ddosService.cleanupExpiredBlocks();
    return {
      success: true,
      message: 'Expired blocks cleaned up successfully'
    };
  }

  // ==================== API GATEWAY ====================

  @Get('gateway/statistics')
  @UseGuards(JwtAuthGuard)
  async getGatewayStatistics() {
    const stats = await this.gatewayService.getGatewayStatistics();
    return {
      success: true,
      data: stats
    };
  }

  @Get('gateway/recommendations')
  @UseGuards(JwtAuthGuard)
  async getLoadBalancingRecommendations() {
    const recommendations = await this.gatewayService.getLoadBalancingRecommendations();
    return {
      success: true,
      data: recommendations
    };
  }

  @Post('gateway/servers')
  @UseGuards(JwtAuthGuard)
  async addServerNode(@Body() nodeData: {
    id: string;
    url: string;
    weight: number;
  }) {
    await this.gatewayService.addServerNode(nodeData);
    return {
      success: true,
      message: 'Server node added successfully'
    };
  }

  @Delete('gateway/servers/:nodeId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeServerNode(@Param('nodeId') nodeId: string) {
    await this.gatewayService.removeServerNode(nodeId);
  }

  @Post('gateway/routing-rules')
  @UseGuards(JwtAuthGuard)
  async addRoutingRule(@Body() ruleData: {
    pattern: string;
    method: string;
    priority: number;
    targetServers: string[];
    conditions?: Record<string, any>;
  }) {
    await this.gatewayService.addRoutingRule(ruleData);
    return {
      success: true,
      message: 'Routing rule added successfully'
    };
  }

  // ==================== BILLING ====================

  @Get('billing/:userId')
  @UseGuards(JwtAuthGuard)
  async generateBillingReport(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const report = await this.apiKeyService.generateBillingReport(
      userId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date()
    );

    return {
      success: true,
      data: report
    };
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getApiKeyStatistics(@Query('userId') userId?: string) {
    const stats = await this.apiKeyService.getApiKeyStatistics(userId);
    return {
      success: true,
      data: stats
    };
  }
}
