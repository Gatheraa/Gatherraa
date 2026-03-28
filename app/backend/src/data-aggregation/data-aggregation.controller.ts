import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { DataAggregationService } from './data-aggregation.service';
import { CreateAggregationRequestDto } from './dto/create-aggregation-request.dto';
import { AggregationResponseDto } from './dto/aggregation-response.dto';
import { DataSourceConfigDto } from './dto/data-source-config.dto';

@Controller('data-aggregation')
export class DataAggregationController {
  private readonly logger = new Logger(DataAggregationController.name);

  constructor(private readonly dataAggregationService: DataAggregationService) {}

  @Post('aggregate')
  async aggregateData(
    @Body(ValidationPipe) createAggregationRequestDto: CreateAggregationRequestDto,
  ): Promise<AggregationResponseDto> {
    try {
      this.logger.log(
        `Starting data aggregation for ${createAggregationRequestDto.dataSources.length} sources`,
      );

      const result = await this.dataAggregationService.aggregateData(
        createAggregationRequestDto.dataSources,
        createAggregationRequestDto.mergeStrategy,
        createAggregationRequestDto.timeout,
      );

      this.logger.log(
        `Data aggregation completed. Success: ${result.successCount}, Failures: ${result.failureCount}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Data aggregation failed', error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Data aggregation failed',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sources')
  async getConfiguredSources(): Promise<DataSourceConfigDto[]> {
    try {
      return await this.dataAggregationService.getConfiguredSources();
    } catch (error) {
      this.logger.error('Failed to get configured sources', error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to retrieve data sources',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sources')
  async addDataSource(
    @Body(ValidationPipe) dataSourceConfig: DataSourceConfigDto,
  ): Promise<DataSourceConfigDto> {
    try {
      this.logger.log(`Adding new data source: ${dataSourceConfig.name}`);
      return await this.dataAggregationService.addDataSource(dataSourceConfig);
    } catch (error) {
      this.logger.error('Failed to add data source', error);
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Failed to add data source',
          message: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('health')
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    activeSources: number;
    lastAggregation?: string;
  }> {
    try {
      return await this.dataAggregationService.getHealthStatus();
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        activeSources: 0,
      };
    }
  }

  @Get('metrics')
  async getMetrics(): Promise<{
    totalAggregations: number;
    successRate: number;
    averageResponseTime: number;
    lastUpdated: string;
  }> {
    try {
      return await this.dataAggregationService.getMetrics();
    } catch (error) {
      this.logger.error('Failed to get metrics', error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to retrieve metrics',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('test-connection')
  async testConnection(
    @Body() dataSource: { endpoint: string; headers?: Record<string, string> },
  ): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    try {
      return await this.dataAggregationService.testConnection(
        dataSource.endpoint,
        dataSource.headers,
      );
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return {
        success: false,
        responseTime: 0,
        error: error.message,
      };
    }
  }
}
