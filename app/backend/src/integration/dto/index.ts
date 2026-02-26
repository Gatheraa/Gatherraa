import { IsString, IsEnum, IsOptional, IsObject, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationType, IntegrationStatus } from '../entities/integration.entity';

export class CreateIntegrationDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(IntegrationType)
  type: IntegrationType;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @IsOptional()
  @IsArray()
  webhookEndpoints?: string[];

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @IsOptional()
  @IsArray()
  webhookEndpoints?: string[];

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class TestConnectionDto {
  @IsString()
  integrationId: string;
}

export class SyncDataDto {
  @IsString()
  integrationId: string;

  @IsOptional()
  @IsObject()
  syncOptions?: Record<string, any>;
}

export class CreateWebhookEventDto {
  @IsString()
  integrationId: string;

  @IsString()
  eventType: string;

  @IsObject()
  payload: Record<string, any>;

  @IsString()
  endpointUrl: string;

  @IsOptional()
  @IsString()
  eventSource?: string;
}

export class CreateDataMappingRuleDto {
  @IsString()
  integrationId: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  sourceField: string;

  @IsString()
  targetField: string;

  @IsString()
  mappingType: string;

  @IsOptional()
  @IsString()
  transformationType?: string;

  @IsOptional()
  @IsObject()
  transformationConfig?: Record<string, any>;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isNullable?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, any>;
}

export class UpdateDataMappingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sourceField?: string;

  @IsOptional()
  @IsString()
  targetField?: string;

  @IsOptional()
  @IsString()
  mappingType?: string;

  @IsOptional()
  @IsString()
  transformationType?: string;

  @IsOptional()
  @IsObject()
  transformationConfig?: Record<string, any>;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isNullable?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransformDataDto {
  @IsString()
  integrationId: string;

  @IsObject()
  sourceData: any;

  @IsOptional()
  @IsObject()
  targetSchema?: Record<string, any>;
}

export class TestMappingRuleDto {
  @IsString()
  ruleId: string;

  @IsObject()
  testData: any;
}

export class CreateLmsConnectionDto {
  @IsString()
  name: string;

  @IsString()
  provider: string;

  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsString()
  adminUserId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  isTestConnection?: boolean;
}

export class UpdateLmsConnectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsString()
  adminUserId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}

export class TestLmsConnectionDto {
  @IsString()
  connectionId: string;
}

export class SyncLmsDataDto {
  @IsString()
  connectionId: string;

  @IsString()
  dataType: 'users' | 'courses' | 'enrollments';

  @IsOptional()
  @IsObject()
  syncOptions?: Record<string, any>;
}

export class CreateMarketplacePluginDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  slug: string;

  @IsString()
  version: string;

  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  authorEmail?: string;

  @IsOptional()
  @IsString()
  authorWebsite?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  pricingModel?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsObject()
  configurationSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  authenticationSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  webhookEvents?: string[];

  @IsOptional()
  @IsArray()
  supportedDataTypes?: string[];

  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  screenshots?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  changelog?: string;

  @IsOptional()
  @IsString()
  minimumVersion?: string;

  @IsOptional()
  @IsString()
  maximumVersion?: string;

  @IsOptional()
  @IsString()
  license?: string;
}

export class UpdateMarketplacePluginDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  authorEmail?: string;

  @IsOptional()
  @IsString()
  authorWebsite?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  pricingModel?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsObject()
  configurationSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  authenticationSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  webhookEvents?: string[];

  @IsOptional()
  @IsArray()
  supportedDataTypes?: string[];

  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  screenshots?: string[];

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  changelog?: string;

  @IsOptional()
  @IsString()
  minimumVersion?: string;

  @IsOptional()
  @IsString()
  maximumVersion?: string;

  @IsOptional()
  @IsString()
  license?: string;
}

export class InstallPluginDto {
  @IsString()
  pluginId: string;

  @IsString()
  integrationId: string;
}

export class UninstallPluginDto {
  @IsString()
  pluginId: string;

  @IsString()
  integrationId: string;
}

export class RatePluginDto {
  @IsString()
  pluginId: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  review?: string;
}

export class RunTestSuiteDto {
  @IsString()
  integrationId: string;

  @IsString()
  testSuiteName: string;

  @IsOptional()
  @IsObject()
  testParameters?: Record<string, any>;
}

export class RunSingleTestDto {
  @IsString()
  integrationId: string;

  @IsString()
  testName: string;

  @IsString()
  testType: string;

  @IsOptional()
  @IsObject()
  testParameters?: Record<string, any>;
}

export class GetAnalyticsDto {
  @IsString()
  integrationId: string;

  @IsOptional()
  @IsString()
  metricType?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, string>;
}
