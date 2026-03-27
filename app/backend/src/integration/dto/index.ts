import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUrl,
  Min,
  Max,
  Length,
  Matches,
  IsUUID,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntegrationType, IntegrationStatus } from '../entities/integration.entity';

// Import validation utilities
import {
  MAX_LENGTHS,
  MIN_LENGTHS,
  VALID_RANGES,
  URL_PROTOCOLS,
  PATTERNS,
  IsSanitizedInput,
} from '../../common/validators';

export class CreateIntegrationDto {
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name: string;

  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description: string;

  @IsEnum(IntegrationType)
  type: IntegrationType;

  @IsOptional()
  @IsString()
  @Matches(PATTERNS.VERSION, { message: 'Version must be in semver format (e.g., 1.0.0)' })
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
  @Min(VALID_RANGES.SYNC_INTERVAL.min)
  @Max(VALID_RANGES.SYNC_INTERVAL.max)
  syncInterval?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEndpoints?: string[];

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.RATE_LIMIT.min)
  @Max(VALID_RANGES.RATE_LIMIT.max)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.MAX_RETRIES.min)
  @Max(VALID_RANGES.MAX_RETRIES.max)
  maxRetries?: number;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description?: string;

  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @IsOptional()
  @IsString()
  @Matches(PATTERNS.VERSION, { message: 'Version must be in semver format' })
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
  @Min(VALID_RANGES.SYNC_INTERVAL.min)
  @Max(VALID_RANGES.SYNC_INTERVAL.max)
  syncInterval?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEndpoints?: string[];

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.RATE_LIMIT.min)
  @Max(VALID_RANGES.RATE_LIMIT.max)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.MAX_RETRIES.min)
  @Max(VALID_RANGES.MAX_RETRIES.max)
  maxRetries?: number;
}

export class TestConnectionDto {
  @IsString()
  @IsUUID()
  integrationId: string;
}

export class SyncDataDto {
  @IsString()
  @IsUUID()
  integrationId: string;

  @IsOptional()
  @IsObject()
  syncOptions?: Record<string, any>;
}

export class CreateWebhookEventDto {
  @IsString()
  @IsUUID()
  integrationId: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  eventType: string;

  @IsObject()
  payload: Record<string, any>;

  @IsString()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  endpointUrl: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  eventSource?: string;
}

export class CreateDataMappingRuleDto {
  @IsString()
  @IsUUID()
  integrationId: string;

  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name: string;

  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  sourceField: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  targetField: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
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
  @Min(VALID_RANGES.PRIORITY.min)
  @Max(VALID_RANGES.PRIORITY.max)
  priority?: number;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, any>;
}

export class UpdateDataMappingRuleDto {
  @IsOptional()
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  sourceField?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
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
  @Min(VALID_RANGES.PRIORITY.min)
  @Max(VALID_RANGES.PRIORITY.max)
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
  @IsUUID()
  integrationId: string;

  @IsObject()
  sourceData: any;

  @IsOptional()
  @IsObject()
  targetSchema?: Record<string, any>;
}

export class TestMappingRuleDto {
  @IsString()
  @IsUUID()
  ruleId: string;

  @IsObject()
  testData: any;
}

export class CreateLmsConnectionDto {
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  provider: string;

  @IsString()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  baseUrl: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.API_KEY)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.API_KEY)
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
  @Min(VALID_RANGES.SYNC_INTERVAL.min)
  @Max(VALID_RANGES.SYNC_INTERVAL.max)
  syncInterval?: number;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  adminUserId?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  isTestConnection?: boolean;
}

export class UpdateLmsConnectionDto {
  @IsOptional()
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.API_KEY)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.API_KEY)
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
  @Min(VALID_RANGES.SYNC_INTERVAL.min)
  @Max(VALID_RANGES.SYNC_INTERVAL.max)
  syncInterval?: number;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  adminUserId?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  accountId?: string;
}

export class TestLmsConnectionDto {
  @IsString()
  @IsUUID()
  connectionId: string;
}

export class SyncLmsDataDto {
  @IsString()
  @IsUUID()
  connectionId: string;

  @IsEnum(['users', 'courses', 'enrollments'])
  dataType: 'users' | 'courses' | 'enrollments';

  @IsOptional()
  @IsObject()
  syncOptions?: Record<string, any>;
}

export class CreateMarketplacePluginDto {
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name: string;

  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description: string;

  @IsString()
  @Length(MIN_LENGTHS.SLUG, MAX_LENGTHS.SLUG)
  @Matches(PATTERNS.SLUG, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  slug: string;

  @IsString()
  @Matches(PATTERNS.VERSION, { message: 'Version must be in semver format' })
  version: string;

  @IsString()
  @Length(1, MAX_LENGTHS.NAME)
  author: string;

  @IsOptional()
  @IsEmail()
  @Length(1, MAX_LENGTHS.EMAIL)
  authorEmail?: string;

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  authorWebsite?: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  type: string;

  @IsOptional()
  @IsString()
  pricingModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.PRICE.min)
  @Max(VALID_RANGES.PRICE.max)
  price?: number;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsObject()
  configurationSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  authenticationSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedDataTypes?: string[];

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  documentationUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http', 'git'], require_tld: false })
  repositoryUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  changelog?: string;

  @IsOptional()
  @Matches(PATTERNS.VERSION)
  minimumVersion?: string;

  @IsOptional()
  @Matches(PATTERNS.VERSION)
  maximumVersion?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  license?: string;
}

export class UpdateMarketplacePluginDto {
  @IsOptional()
  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  @IsSanitizedInput()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  description?: string;

  @IsOptional()
  @Matches(PATTERNS.VERSION)
  version?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.NAME)
  author?: string;

  @IsOptional()
  @IsEmail()
  @Length(1, MAX_LENGTHS.EMAIL)
  authorEmail?: string;

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
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
  @Min(VALID_RANGES.PRICE.min)
  @Max(VALID_RANGES.PRICE.max)
  price?: number;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsObject()
  configurationSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  authenticationSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webhookEvents?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedDataTypes?: string[];

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  documentationUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http', 'git'], require_tld: false })
  repositoryUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: URL_PROTOCOLS, require_tld: true })
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  changelog?: string;

  @IsOptional()
  @Matches(PATTERNS.VERSION)
  minimumVersion?: string;

  @IsOptional()
  @Matches(PATTERNS.VERSION)
  maximumVersion?: string;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  license?: string;
}

export class InstallPluginDto {
  @IsString()
  @IsUUID()
  pluginId: string;

  @IsString()
  @IsUUID()
  integrationId: string;
}

export class UninstallPluginDto {
  @IsString()
  @IsUUID()
  pluginId: string;

  @IsString()
  @IsUUID()
  integrationId: string;
}

export class RatePluginDto {
  @IsString()
  @IsUUID()
  pluginId: string;

  @IsOptional()
  @IsNumber()
  @Min(VALID_RANGES.RATING.min)
  @Max(VALID_RANGES.RATING.max)
  rating?: number;

  @IsOptional()
  @IsString()
  @Length(1, MAX_LENGTHS.DESCRIPTION)
  @IsSanitizedInput()
  review?: string;
}

export class RunTestSuiteDto {
  @IsString()
  @IsUUID()
  integrationId: string;

  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  testSuiteName: string;

  @IsOptional()
  @IsObject()
  testParameters?: Record<string, any>;
}

export class RunSingleTestDto {
  @IsString()
  @IsUUID()
  integrationId: string;

  @IsString()
  @Length(MIN_LENGTHS.NAME, MAX_LENGTHS.NAME)
  testName: string;

  @IsString()
  @Length(1, MAX_LENGTHS.GENERAL_STRING)
  testType: string;

  @IsOptional()
  @IsObject()
  testParameters?: Record<string, any>;
}

export class GetAnalyticsDto {
  @IsString()
  @IsUUID()
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
