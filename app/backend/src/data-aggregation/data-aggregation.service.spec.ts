import { Test, TestingModule } from '@nestjs/testing';
import { DataAggregationService } from './data-aggregation.service';
import { DataSourceConfigDto } from './dto/data-source-config.dto';
import axios from 'axios';

jest.mock('axios');

describe('DataAggregationService', () => {
  let service: DataAggregationService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  const mockDataSource: DataSourceConfigDto = {
    id: 'test-api',
    name: 'Test API',
    endpoint: 'https://api.test.com/data',
    priority: 1,
    timeout: 5000,
    retryCount: 2,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataAggregationService],
    }).compile();

    service = module.get<DataAggregationService>(DataAggregationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addDataSource', () => {
    it('should add a new data source successfully', async () => {
      const result = await service.addDataSource(mockDataSource);
      
      expect(result).toEqual(mockDataSource);
      
      const configuredSources = await service.getConfiguredSources();
      expect(configuredSources).toContainEqual(mockDataSource);
    });

    it('should throw error when adding duplicate data source', async () => {
      await service.addDataSource(mockDataSource);
      
      await expect(service.addDataSource(mockDataSource)).rejects.toThrow(
        `Data source with id '${mockDataSource.id}' already exists`
      );
    });
  });

  describe('testConnection', () => {
    it('should return success for valid endpoint', async () => {
      const mockResponse = { data: 'test' };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await service.testConnection('https://valid-endpoint.com');

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return failure for invalid endpoint', async () => {
      const error = new Error('Network Error');
      mockedAxios.get.mockRejectedValue(error);

      const result = await service.testConnection('https://invalid-endpoint.com');

      expect(result.success).toBe(false);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.activeSources).toBeGreaterThan(0);
      expect(health.timestamp).toBeDefined();
    });
  });
});
