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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IntegrationService } from '../services/integration.service';
import { WebhookService } from '../services/webhook.service';
import { DataMappingService } from '../services/data-mapping.service';
import { LmsIntegrationService } from '../services/lms-integration.service';
import { IntegrationMarketplaceService } from '../services/integration-marketplace.service';
import { IntegrationTestingService } from '../services/integration-testing.service';
import { IntegrationAnalyticsService } from '../services/integration-analytics.service';
import { IntegrationSecurityService } from '../services/integration-security.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  TestConnectionDto,
  SyncDataDto,
  CreateWebhookEventDto,
  CreateDataMappingRuleDto,
  UpdateDataMappingRuleDto,
  TransformDataDto,
  TestMappingRuleDto,
  CreateLmsConnectionDto,
  UpdateLmsConnectionDto,
  TestLmsConnectionDto,
  SyncLmsDataDto,
  CreateMarketplacePluginDto,
  UpdateMarketplacePluginDto,
  InstallPluginDto,
  UninstallPluginDto,
  RatePluginDto,
  RunTestSuiteDto,
  RunSingleTestDto,
  GetAnalyticsDto,
} from '../dto';

@ApiTags('Integration')
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly webhookService: WebhookService,
    private readonly dataMappingService: DataMappingService,
    private readonly lmsIntegrationService: LmsIntegrationService,
    private readonly marketplaceService: IntegrationMarketplaceService,
    private readonly testingService: IntegrationTestingService,
    private readonly analyticsService: IntegrationAnalyticsService,
    private readonly securityService: IntegrationSecurityService,
  ) {}

  // Integration Management
  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  async createIntegration(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationService.create(createIntegrationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all integrations' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by integration type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async getIntegrations(@Query() filters: any) {
    return this.integrationService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async getIntegration(@Param('id') id: string) {
    return this.integrationService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async updateIntegration(
    @Param('id') id: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
  ) {
    return this.integrationService.update(id, updateIntegrationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIntegration(@Param('id') id: string) {
    return this.integrationService.remove(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async activateIntegration(@Param('id') id: string) {
    return this.integrationService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async deactivateIntegration(@Param('id') id: string) {
    return this.integrationService.deactivate(id);
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test integration connection' })
  async testConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.integrationService.testConnection(testConnectionDto.integrationId);
  }

  @Post('sync-data')
  @ApiOperation({ summary: 'Sync integration data' })
  async syncData(@Body() syncDataDto: SyncDataDto) {
    return this.integrationService.syncData(syncDataDto.integrationId);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get integration logs' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  async getIntegrationLogs(@Param('id') id: string, @Query() filters: any) {
    return this.integrationService.getIntegrationLogs(id, filters);
  }

  // Webhook Management
  @Post('webhooks')
  @ApiOperation({ summary: 'Create webhook event' })
  async createWebhookEvent(@Body() createWebhookEventDto: CreateWebhookEventDto) {
    return this.webhookService.createWebhookEvent(
      createWebhookEventDto.integrationId,
      createWebhookEventDto.eventType as any,
      createWebhookEventDto.payload,
      createWebhookEventDto.endpointUrl,
      createWebhookEventDto.eventSource,
    );
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'Get webhook events' })
  async getWebhookEvents(@Query() filters: any) {
    return this.webhookService.getWebhookEvents(filters);
  }

  @Post('webhooks/:id/retry')
  @ApiOperation({ summary: 'Retry failed webhook' })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  async retryWebhook(@Param('id') id: string) {
    return this.webhookService.retryFailedWebhook(id);
  }

  @Get('webhooks/stats')
  @ApiOperation({ summary: 'Get webhook statistics' })
  async getWebhookStats(@Query('integrationId') integrationId?: string) {
    return this.webhookService.getWebhookStats(integrationId);
  }

  // Data Mapping
  @Post('data-mapping/rules')
  @ApiOperation({ summary: 'Create data mapping rule' })
  async createMappingRule(@Body() createRuleDto: CreateDataMappingRuleDto) {
    return this.dataMappingService.createMappingRule(
      createRuleDto.integrationId,
      createRuleDto,
    );
  }

  @Get('data-mapping/rules/:integrationId')
  @ApiOperation({ summary: 'Get data mapping rules' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getMappingRules(@Param('integrationId') integrationId: string) {
    return this.dataMappingService.getMappingRules(integrationId);
  }

  @Put('data-mapping/rules/:id')
  @ApiOperation({ summary: 'Update data mapping rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  async updateMappingRule(
    @Param('id') id: string,
    @Body() updateRuleDto: UpdateDataMappingRuleDto,
  ) {
    return this.dataMappingService.updateMappingRule(id, updateRuleDto);
  }

  @Delete('data-mapping/rules/:id')
  @ApiOperation({ summary: 'Delete data mapping rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMappingRule(@Param('id') id: string) {
    return this.dataMappingService.deleteMappingRule(id);
  }

  @Post('data-mapping/transform')
  @ApiOperation({ summary: 'Transform data using mapping rules' })
  async transformData(@Body() transformDataDto: TransformDataDto) {
    return this.dataMappingService.transformData(
      transformDataDto.integrationId,
      transformDataDto.sourceData,
      transformDataDto.targetSchema,
    );
  }

  @Post('data-mapping/test-rule')
  @ApiOperation({ summary: 'Test data mapping rule' })
  async testMappingRule(@Body() testRuleDto: TestMappingRuleDto) {
    return this.dataMappingService.testMappingRule(testRuleDto.ruleId, testRuleDto.testData);
  }

  // LMS Integration
  @Post('lms/connections')
  @ApiOperation({ summary: 'Create LMS connection' })
  async createLmsConnection(@Body() createConnectionDto: CreateLmsConnectionDto) {
    return this.lmsIntegrationService.createConnection(createConnectionDto);
  }

  @Get('lms/connections')
  @ApiOperation({ summary: 'Get LMS connections' })
  async getLmsConnections(@Query() filters: any) {
    return this.lmsIntegrationService.getConnections(filters);
  }

  @Get('lms/connections/:id')
  @ApiOperation({ summary: 'Get LMS connection by ID' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  async getLmsConnection(@Param('id') id: string) {
    return this.lmsIntegrationService.getConnection(id);
  }

  @Put('lms/connections/:id')
  @ApiOperation({ summary: 'Update LMS connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  async updateLmsConnection(
    @Param('id') id: string,
    @Body() updateConnectionDto: UpdateLmsConnectionDto,
  ) {
    return this.lmsIntegrationService.updateConnection(id, updateConnectionDto);
  }

  @Delete('lms/connections/:id')
  @ApiOperation({ summary: 'Delete LMS connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLmsConnection(@Param('id') id: string) {
    return this.lmsIntegrationService.deleteConnection(id);
  }

  @Post('lms/connections/test')
  @ApiOperation({ summary: 'Test LMS connection' })
  async testLmsConnection(@Body() testConnectionDto: TestLmsConnectionDto) {
    return this.lmsIntegrationService.testConnection(testConnectionDto.connectionId);
  }

  @Post('lms/sync')
  @ApiOperation({ summary: 'Sync LMS data' })
  async syncLmsData(@Body() syncDataDto: SyncLmsDataDto) {
    switch (syncDataDto.dataType) {
      case 'users':
        return this.lmsIntegrationService.syncUsers(syncDataDto.connectionId);
      case 'courses':
        return this.lmsIntegrationService.syncCourses(syncDataDto.connectionId);
      case 'enrollments':
        return this.lmsIntegrationService.syncEnrollments(syncDataDto.connectionId);
      default:
        throw new Error(`Invalid data type: ${syncDataDto.dataType}`);
    }
  }

  // Marketplace
  @Post('marketplace/plugins')
  @ApiOperation({ summary: 'Create marketplace plugin' })
  async createPlugin(@Body() createPluginDto: CreateMarketplacePluginDto) {
    return this.marketplaceService.createPlugin(createPluginDto);
  }

  @Get('marketplace/plugins')
  @ApiOperation({ summary: 'Get marketplace plugins' })
  async getPlugins(@Query() filters: any) {
    return this.marketplaceService.getPlugins(filters);
  }

  @Get('marketplace/plugins/:id')
  @ApiOperation({ summary: 'Get plugin by ID' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async getPlugin(@Param('id') id: string) {
    return this.marketplaceService.getPlugin(id);
  }

  @Get('marketplace/plugins/slug/:slug')
  @ApiOperation({ summary: 'Get plugin by slug' })
  @ApiParam({ name: 'slug', description: 'Plugin slug' })
  async getPluginBySlug(@Param('slug') slug: string) {
    return this.marketplaceService.getPluginBySlug(slug);
  }

  @Put('marketplace/plugins/:id')
  @ApiOperation({ summary: 'Update plugin' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  async updatePlugin(
    @Param('id') id: string,
    @Body() updatePluginDto: UpdateMarketplacePluginDto,
  ) {
    return this.marketplaceService.updatePlugin(id, updatePluginDto);
  }

  @Delete('marketplace/plugins/:id')
  @ApiOperation({ summary: 'Delete plugin' })
  @ApiParam({ name: 'id', description: 'Plugin ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlugin(@Param('id') id: string) {
    return this.marketplaceService.deletePlugin(id);
  }

  @Post('marketplace/plugins/install')
  @ApiOperation({ summary: 'Install plugin' })
  async installPlugin(@Body() installPluginDto: InstallPluginDto) {
    return this.marketplaceService.installPlugin(
      installPluginDto.pluginId,
      installPluginDto.integrationId,
    );
  }

  @Post('marketplace/plugins/uninstall')
  @ApiOperation({ summary: 'Uninstall plugin' })
  async uninstallPlugin(@Body() uninstallPluginDto: UninstallPluginDto) {
    return this.marketplaceService.uninstallPlugin(
      uninstallPluginDto.pluginId,
      uninstallPluginDto.integrationId,
    );
  }

  @Post('marketplace/plugins/rate')
  @ApiOperation({ summary: 'Rate plugin' })
  async ratePlugin(@Body() ratePluginDto: RatePluginDto) {
    return this.marketplaceService.ratePlugin(
      ratePluginDto.pluginId,
      ratePluginDto.rating,
      ratePluginDto.review,
    );
  }

  @Get('marketplace/plugins/featured')
  @ApiOperation({ summary: 'Get featured plugins' })
  async getFeaturedPlugins(@Query('limit') limit?: number) {
    return this.marketplaceService.getFeaturedPlugins(limit);
  }

  @Get('marketplace/plugins/popular')
  @ApiOperation({ summary: 'Get popular plugins' })
  async getPopularPlugins(@Query('limit') limit?: number) {
    return this.marketplaceService.getPopularPlugins(limit);
  }

  @Get('marketplace/stats')
  @ApiOperation({ summary: 'Get marketplace statistics' })
  async getMarketplaceStats() {
    return this.marketplaceService.getPluginStats();
  }

  // Testing
  @Post('testing/test-suite')
  @ApiOperation({ summary: 'Run test suite' })
  async runTestSuite(@Body() runTestSuiteDto: RunTestSuiteDto) {
    return this.testingService.runTestSuite(
      runTestSuiteDto.integrationId,
      runTestSuiteDto.testSuiteName,
      runTestSuiteDto.testParameters,
    );
  }

  @Post('testing/single-test')
  @ApiOperation({ summary: 'Run single test' })
  async runSingleTest(@Body() runSingleTestDto: RunSingleTestDto) {
    return this.testingService.runSingleTest(
      runSingleTestDto.integrationId,
      {
        name: runSingleTestDto.testName,
        type: runSingleTestDto.testType as any,
        description: `Single test: ${runSingleTestDto.testName}`,
      },
      runSingleTestDto.testParameters,
    );
  }

  @Get('testing/results/:integrationId')
  @ApiOperation({ summary: 'Get test results' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getTestResults(@Param('integrationId') integrationId: string, @Query() filters: any) {
    return this.testingService.getTestResults(integrationId, filters);
  }

  @Get('testing/results/detail/:resultId')
  @ApiOperation({ summary: 'Get test result details' })
  @ApiParam({ name: 'resultId', description: 'Test result ID' })
  async getTestResult(@Param('resultId') resultId: string) {
    return this.testingService.getTestResult(resultId);
  }

  @Get('testing/summary/:integrationId')
  @ApiOperation({ summary: 'Get test summary' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getTestSummary(@Param('integrationId') integrationId: string, @Query('days') days?: number) {
    return this.testingService.getTestSummary(integrationId, days);
  }

  // Analytics
  @Get('analytics/metrics')
  @ApiOperation({ summary: 'Get integration metrics' })
  async getMetrics(@Query() getAnalyticsDto: GetAnalyticsDto) {
    return this.analyticsService.getMetrics(
      getAnalyticsDto.integrationId,
      {
        metricType: getAnalyticsDto.metricType as any,
        period: getAnalyticsDto.period as any,
        startDate: getAnalyticsDto.startDate ? new Date(getAnalyticsDto.startDate) : undefined,
        endDate: getAnalyticsDto.endDate ? new Date(getAnalyticsDto.endDate) : undefined,
        dimensions: getAnalyticsDto.dimensions,
      },
    );
  }

  @Get('analytics/health/:integrationId')
  @ApiOperation({ summary: 'Get integration health score' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getHealthScore(@Param('integrationId') integrationId: string) {
    return this.analyticsService.getIntegrationHealthScore(integrationId);
  }

  @Get('analytics/usage/:integrationId')
  @ApiOperation({ summary: 'Get usage report' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getUsageReport(
    @Param('integrationId') integrationId: string,
    @Query('period') period?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getUsageReport(integrationId, period);
  }

  @Get('analytics/trends/:integrationId')
  @ApiOperation({ summary: 'Get performance trends' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async getPerformanceTrends(
    @Param('integrationId') integrationId: string,
    @Query('period') period?: 'hour' | 'day' | 'week',
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getPerformanceTrends(integrationId, period, limit);
  }

  @Get('analytics/report')
  @ApiOperation({ summary: 'Generate analytics report' })
  async generateAnalyticsReport(@Query('integrationId') integrationId?: string) {
    return this.analyticsService.generateAnalyticsReport(integrationId);
  }

  @Get('analytics/top-integrations')
  @ApiOperation({ summary: 'Get top integrations by usage' })
  async getTopIntegrations(@Query('limit') limit?: number) {
    return this.analyticsService.getTopIntegrationsByUsage(limit);
  }

  // Security
  @Post('security/validate-config')
  @ApiOperation({ summary: 'Validate integration configuration' })
  async validateConfig(@Body() config: any) {
    return this.securityService.validateIntegrationConfig(config);
  }

  @Post('security/compliance/:integrationId')
  @ApiOperation({ summary: 'Check compliance' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  async checkCompliance(@Param('integrationId') integrationId: string) {
    return this.securityService.checkCompliance(integrationId);
  }

  @Post('security/sanitize-data')
  @ApiOperation({ summary: 'Sanitize sensitive data' })
  async sanitizeData(@Body() data: any) {
    return this.securityService.sanitizeData(data);
  }
}
