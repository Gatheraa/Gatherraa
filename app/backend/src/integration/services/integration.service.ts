import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThan } from 'typeorm';
import { Integration, IntegrationType, IntegrationStatus } from '../entities/integration.entity';
import { IntegrationLog, LogLevel, LogCategory } from '../entities/integration-log.entity';
import { CreateIntegrationDto } from '../dto/create-integration.dto';
import { UpdateIntegrationDto } from '../dto/update-integration.dto';
import { IntegrationAnalyticsService } from './integration-analytics.service';
import { IntegrationSecurityService } from './integration-security.service';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
    private readonly analyticsService: IntegrationAnalyticsService,
    private readonly securityService: IntegrationSecurityService,
  ) {}

  async create(createIntegrationDto: CreateIntegrationDto): Promise<Integration> {
    this.logger.log(`Creating new integration: ${createIntegrationDto.name}`);

    // Validate configuration
    await this.securityService.validateIntegrationConfig(createIntegrationDto);

    const integration = this.integrationRepository.create(createIntegrationDto);
    const savedIntegration = await this.integrationRepository.save(integration);

    // Log creation
    await this.logIntegrationEvent(
      savedIntegration.id,
      LogLevel.INFO,
      LogCategory.API_CALL,
      `Integration created: ${savedIntegration.name}`,
      { integrationId: savedIntegration.id }
    );

    // Track metrics
    await this.analyticsService.trackMetric(
      savedIntegration.id,
      'INTEGRATION_CREATED',
      1,
      { type: savedIntegration.type }
    );

    return savedIntegration;
  }

  async findAll(filters?: {
    type?: IntegrationType;
    status?: IntegrationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ integrations: Integration[]; total: number }> {
    const { type, status, search, page = 1, limit = 10 } = filters || {};

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [integrations, total] = await this.integrationRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['logs', 'metrics'],
    });

    return { integrations, total };
  }

  async findOne(id: string): Promise<Integration> {
    const integration = await this.integrationRepository.findOne({
      where: { id },
      relations: ['logs', 'dataMappingRules', 'metrics'],
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    return integration;
  }

  async update(id: string, updateIntegrationDto: UpdateIntegrationDto): Promise<Integration> {
    this.logger.log(`Updating integration: ${id}`);

    const integration = await this.findOne(id);

    // Validate updated configuration
    if (updateIntegrationDto.configuration) {
      await this.securityService.validateIntegrationConfig({
        ...integration,
        ...updateIntegrationDto,
      });
    }

    Object.assign(integration, updateIntegrationDto);
    const updatedIntegration = await this.integrationRepository.save(integration);

    // Log update
    await this.logIntegrationEvent(
      id,
      LogLevel.INFO,
      LogCategory.API_CALL,
      `Integration updated: ${updatedIntegration.name}`,
      { changes: updateIntegrationDto }
    );

    return updatedIntegration;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing integration: ${id}`);

    const integration = await this.findOne(id);
    
    // Soft delete by marking as inactive
    integration.isActive = false;
    integration.status = IntegrationStatus.INACTIVE;
    await this.integrationRepository.save(integration);

    // Log deletion
    await this.logIntegrationEvent(
      id,
      LogLevel.INFO,
      LogCategory.API_CALL,
      `Integration deactivated: ${integration.name}`,
      { integrationId: id }
    );
  }

  async activate(id: string): Promise<Integration> {
    const integration = await this.findOne(id);
    
    integration.status = IntegrationStatus.ACTIVE;
    integration.isActive = true;
    integration.errorMessage = null;
    integration.currentRetryCount = 0;

    return await this.integrationRepository.save(integration);
  }

  async deactivate(id: string): Promise<Integration> {
    const integration = await this.findOne(id);
    
    integration.status = IntegrationStatus.INACTIVE;
    integration.isActive = false;

    return await this.integrationRepository.save(integration);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Testing connection for integration: ${id}`);

    const integration = await this.findOne(id);

    try {
      // This would be implemented based on the integration type
      // For now, we'll simulate a connection test
      const testResult = await this.performConnectionTest(integration);

      await this.logIntegrationEvent(
        id,
        LogLevel.INFO,
        LogCategory.AUTHENTICATION,
        `Connection test ${testResult.success ? 'passed' : 'failed'}`,
        { success: testResult.success, message: testResult.message }
      );

      return testResult;
    } catch (error) {
      await this.logIntegrationEvent(
        id,
        LogLevel.ERROR,
        LogCategory.AUTHENTICATION,
        `Connection test failed: ${error.message}`,
        { error: error.message }
      );

      return { success: false, message: error.message };
    }
  }

  async syncData(id: string): Promise<{ success: boolean; message: string; recordsProcessed?: number }> {
    this.logger.log(`Syncing data for integration: ${id}`);

    const integration = await this.findOne(id);

    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Integration must be active to sync data');
    }

    try {
      const syncResult = await this.performDataSync(integration);

      // Update sync timestamps
      integration.lastSyncAt = new Date();
      integration.nextSyncAt = new Date(Date.now() + integration.syncInterval * 60 * 1000);
      await this.integrationRepository.save(integration);

      await this.logIntegrationEvent(
        id,
        LogLevel.INFO,
        LogCategory.DATA_SYNC,
        `Data sync completed: ${syncResult.recordsProcessed} records processed`,
        syncResult
      );

      return syncResult;
    } catch (error) {
      integration.currentRetryCount++;
      integration.errorMessage = error.message;

      if (integration.currentRetryCount >= integration.maxRetries) {
        integration.status = IntegrationStatus.ERROR;
      }

      await this.integrationRepository.save(integration);

      await this.logIntegrationEvent(
        id,
        LogLevel.ERROR,
        LogCategory.DATA_SYNC,
        `Data sync failed: ${error.message}`,
        { error: error.message, retryCount: integration.currentRetryCount }
      );

      throw error;
    }
  }

  async getIntegrationLogs(id: string, filters?: {
    level?: LogLevel;
    category?: LogCategory;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: IntegrationLog[]; total: number }> {
    const { level, category, startDate, endDate, page = 1, limit = 50 } = filters || {};

    const where: any = { integrationId: id };
    if (level) where.level = level;
    if (category) where.category = category;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [logs, total] = await this.logRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { logs, total };
  }

  private async performConnectionTest(integration: Integration): Promise<{ success: boolean; message: string }> {
    // This would be implemented based on the integration type
    // For now, we'll simulate a basic connection test
    switch (integration.type) {
      case IntegrationType.LMS:
        return { success: true, message: 'LMS connection test successful' };
      case IntegrationType.CRM:
        return { success: true, message: 'CRM connection test successful' };
      default:
        return { success: true, message: 'Connection test successful' };
    }
  }

  private async performDataSync(integration: Integration): Promise<{ success: boolean; message: string; recordsProcessed: number }> {
    // This would be implemented based on the integration type
    // For now, we'll simulate a data sync
    const recordsProcessed = Math.floor(Math.random() * 100) + 1;
    return {
      success: true,
      message: `Data sync completed successfully`,
      recordsProcessed,
    };
  }

  private async logIntegrationEvent(
    integrationId: string,
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const log = this.logRepository.create({
      integrationId,
      level,
      category,
      message,
      metadata,
    });

    await this.logRepository.save(log);
  }
}
