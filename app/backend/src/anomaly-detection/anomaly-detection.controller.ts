/**
 * Anomaly Detection REST API Controller
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  OrderbookSnapshot,
  OrderbookEvent,
  MarketData,
  AnomalyAlert,
  AnomalyConfig,
} from './types/order-book.types';
import { AnomalyDetectionCoordinatorService, DetectionReport } from './coordinator/anomaly-detection-coordinator.service';
import { AnomalyAlertService } from './alerts/anomaly-alert.service';

@ApiTags('Anomaly Detection')
@Controller('api/anomaly-detection')
export class AnomalyDetectionController {
  constructor(
    private coordinator: AnomalyDetectionCoordinatorService,
    private alertService: AnomalyAlertService,
  ) {}

  /**
   * Ingest orderbook snapshot
   */
  @Post('orderbook/snapshot')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest an orderbook snapshot' })
  @ApiResponse({
    status: 202,
    description: 'Snapshot ingested and detection started',
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async ingestSnapshot(@Body() snapshot: OrderbookSnapshot): Promise<DetectionReport> {
    if (!snapshot.symbol || !snapshot.bids || !snapshot.asks) {
      throw new BadRequestException(
        'Invalid snapshot: must include symbol, bids, and asks',
      );
    }

    try {
      return await this.coordinator.processOrderbookSnapshot(snapshot);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to process snapshot: ${error.message}`,
      );
    }
  }

  /**
   * Ingest batch orderbook snapshots
   */
  @Post('orderbook/snapshot-batch')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest batch of orderbook snapshots' })
  @ApiResponse({ status: 202, description: 'Snapshots ingested' })
  async ingestSnapshotBatch(
    @Body() snapshots: OrderbookSnapshot[],
  ): Promise<DetectionReport[]> {
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      throw new BadRequestException('Must provide array of snapshots');
    }

    const reports: DetectionReport[] = [];
    for (const snapshot of snapshots) {
      try {
        reports.push(await this.coordinator.processOrderbookSnapshot(snapshot));
      } catch (error) {
        this.coordinator.processOrderbookSnapshot(snapshot).catch(() => {
          // Log and continue
        });
      }
    }
    return reports;
  }

  /**
   * Ingest orderbook event
   */
  @Post('orderbook/event')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest an orderbook event (order, cancel, etc)' })
  @ApiResponse({ status: 202, description: 'Event ingested' })
  async ingestEvent(@Body() event: OrderbookEvent): Promise<{ success: boolean }> {
    if (!event.symbol || !event.orderId || !event.traderId) {
      throw new BadRequestException(
        'Invalid event: must include symbol, orderId, and traderId',
      );
    }

    try {
      await this.coordinator.processOrderbookEvent(event);
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to process event: ${error.message}`);
    }
  }

  /**
   * Ingest market data
   */
  @Post('market-data')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest market data' })
  @ApiResponse({ status: 202, description: 'Market data ingested' })
  async ingestMarketData(@Body() marketData: MarketData): Promise<{ success: boolean }> {
    if (!marketData.symbol) {
      throw new BadRequestException('Market data must include symbol');
    }

    try {
      await this.coordinator.processMarketData(marketData);
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to process market data: ${error.message}`,
      );
    }
  }

  /**
   * Get alerts for a symbol
   */
  @Get('alerts/symbol/:symbol')
  @ApiOperation({ summary: 'Get anomaly alerts for a symbol' })
  @ApiParam({ name: 'symbol', type: 'string', description: 'Trading symbol' })
  @ApiResponse({
    status: 200,
    description: 'List of alerts',
    type: [AnomalyAlert],
  })
  getSymbolAlerts(@Param('symbol') symbol: string): AnomalyAlert[] {
    return this.coordinator.getSymbolAlerts(symbol);
  }

  /**
   * Get alerts for a trader
   */
  @Get('alerts/trader/:traderId')
  @ApiOperation({ summary: 'Get anomaly alerts for a trader' })
  @ApiParam({ name: 'traderId', type: 'string', description: 'Trader identifier' })
  @ApiResponse({
    status: 200,
    description: 'List of alerts',
    type: [AnomalyAlert],
  })
  getTraderAlerts(@Param('traderId') traderId: string): AnomalyAlert[] {
    return this.coordinator.getTraderAlerts(traderId);
  }

  /**
   * Get a specific alert
   */
  @Get('alerts/:alertId')
  @ApiOperation({ summary: 'Get a specific alert' })
  @ApiParam({ name: 'alertId', type: 'string', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert details' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  getAlert(@Param('alertId') alertId: string): AnomalyAlert {
    const alert = this.alertService.getAlert(alertId);
    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return alert;
  }

  /**
   * Acknowledge an alert
   */
  @Put('alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Query('acknowledgedBy') acknowledgedBy?: string,
  ): { success: boolean } {
    const success = this.alertService.acknowledgeAlert(alertId, acknowledgedBy);
    if (!success) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return { success };
  }

  /**
   * Set alert status to investigating
   */
  @Put('alerts/:alertId/investigating')
  @ApiOperation({ summary: 'Set alert status to investigating' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  setInvestigating(@Param('alertId') alertId: string): { success: boolean } {
    const success = this.alertService.setAlertInvestigating(alertId);
    if (!success) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return { success };
  }

  /**
   * Resolve an alert
   */
  @Put('alerts/:alertId/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiQuery({
    name: 'as',
    enum: ['RESOLVED', 'FALSE_POSITIVE'],
    description: 'Resolution type',
  })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  resolveAlert(
    @Param('alertId') alertId: string,
    @Query('as') resolution: 'RESOLVED' | 'FALSE_POSITIVE' = 'RESOLVED',
  ): { success: boolean } {
    const success = this.alertService.resolveAlert(alertId, resolution);
    if (!success) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    return { success };
  }

  /**
   * Execute an action on an alert
   */
  @Post('alerts/:alertId/action')
  @ApiOperation({ summary: 'Execute an action on an alert' })
  @ApiParam({ name: 'alertId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Action executed',
  })
  executeAction(
    @Param('alertId') alertId: string,
    @Query('type')
    actionType:
      | 'THROTTLE'
      | 'BLOCK'
      | 'AUTO_BAN'
      | 'REVIEW'
      | 'ESCALATE' = 'THROTTLE',
    @Body() parameters?: Record<string, any>,
  ): { success: boolean; result?: string } {
    const action = this.alertService.executeAction(alertId, actionType, parameters);
    if (!action) {
      throw new NotFoundException(`Alert ${alertId} not found or invalid action`);
    }
    return { success: action.status === 'EXECUTED', result: action.result };
  }

  /**
   * Get alert statistics
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiQuery({ name: 'days', type: 'number', description: 'Period in days' })
  @ApiResponse({ status: 200, description: 'Statistics' })
  getStatistics(@Query('days') days: number = 7): any {
    return this.coordinator.getAlertStatistics(days);
  }

  /**
   * Get anomaly detection configuration
   */
  @Get('config')
  @ApiOperation({ summary: 'Get current configuration' })
  @ApiResponse({ status: 200, description: 'Configuration' })
  getConfig(): AnomalyConfig {
    return this.coordinator.getConfig();
  }

  /**
   * Update anomaly detection configuration
   */
  @Put('config')
  @ApiOperation({ summary: 'Update configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  updateConfig(@Body() config: Partial<AnomalyConfig>): { success: boolean } {
    this.coordinator.updateConfig(config);
    return { success: true };
  }

  /**
   * Check if a trader is throttled
   */
  @Get('throttle/:traderId')
  @ApiOperation({ summary: 'Check throttle status for a trader' })
  @ApiParam({ name: 'traderId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Throttle info' })
  getThrottleStatus(@Param('traderId') traderId: string): {
    isThrottled: boolean;
    until?: number;
    reason?: string;
  } {
    const throttleInfo = this.alertService.getThrottleInfo(traderId);
    if (throttleInfo) {
      return {
        isThrottled: true,
        until: throttleInfo.until,
        reason: throttleInfo.reason,
      };
    }
    return { isThrottled: false };
  }

  /**
   * Export alerts as CSV or JSON
   */
  @Get('export')
  @ApiOperation({ summary: 'Export alerts' })
  @ApiQuery({
    name: 'format',
    enum: ['json', 'csv'],
    default: 'json',
  })
  @ApiResponse({ status: 200, description: 'Exported data' })
  exportAlerts(@Query('format') format: 'json' | 'csv' = 'json'): any {
    const data = this.coordinator.exportAuditTrail(format);
    if (format === 'csv') {
      return { csv: data };
    }
    return JSON.parse(data);
  }

  /**
   * Run backtest on historical data
   */
  @Post('backtest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run backtest on historical data' })
  @ApiResponse({
    status: 200,
    description: 'Backtest results',
  })
  async runBacktest(
    @Body()
    request: {
      symbol: string;
      startTime: number;
      endTime: number;
      snapshots: OrderbookSnapshot[];
      events: OrderbookEvent[];
    },
  ): Promise<any> {
    if (
      !request.symbol ||
      typeof request.startTime !== 'number' ||
      typeof request.endTime !== 'number'
    ) {
      throw new BadRequestException(
        'Invalid request: must include symbol, startTime, endTime',
      );
    }

    if (request.startTime >= request.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    try {
      return await this.coordinator.runBacktest(
        request.symbol,
        request.startTime,
        request.endTime,
        request.snapshots || [],
        request.events || [],
      );
    } catch (error) {
      throw new InternalServerErrorException(`Backtest failed: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health(): { status: string; timestamp: number } {
    return {
      status: 'healthy',
      timestamp: Date.now(),
    };
  }
}
