import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AdvancedCacheService } from '../services/advanced-cache.service';
import { CacheWarmupService } from '../services/cache-warmup.service';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { CachePerformanceService } from '../services/cache-performance.service';
import { MultiLevelCacheService } from '../services/multi-level-cache.service';
import { CacheSerializationService } from '../services/cache-serialization.service';
import { CacheAnalyticsService } from '../services/cache-analytics.service';
import { CacheFallbackService } from '../services/cache-fallback.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/cache')
export class CacheManagementController {
  constructor(
    private cacheService: AdvancedCacheService,
    private warmupService: CacheWarmupService,
    private invalidationService: CacheInvalidationService,
    private performanceService: CachePerformanceService,
    private multiLevelCache: MultiLevelCacheService,
    private serializationService: CacheSerializationService,
    private analyticsService: CacheAnalyticsService,
    private fallbackService: CacheFallbackService,
  ) {}

  // ==================== BASIC CACHE OPERATIONS ====================

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getCacheStats() {
    const stats = await this.cacheService.getStats();
    return {
      success: true,
      data: stats
    };
  }

  @Get('key/:key')
  @UseGuards(JwtAuthGuard)
  async getCacheKey(@Param('key') key: string) {
    const value = await this.cacheService.get(key);
    return {
      success: true,
      data: { key, value }
    };
  }

  @Post('key/:key')
  @UseGuards(JwtAuthGuard)
  async setCacheKey(
    @Param('key') key: string,
    @Body() body: { value: any; ttl?: number; compress?: boolean }
  ) {
    await this.cacheService.set(key, body.value, {
      ttl: body.ttl,
      compress: body.compress
    });
    
    return {
      success: true,
      message: 'Cache key set successfully'
    };
  }

  @Delete('key/:key')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCacheKey(@Param('key') key: string) {
    await this.cacheService.delete(key);
  }

  @Post('invalidate')
  @UseGuards(JwtAuthGuard)
  async invalidatePattern(@Body() body: { pattern: string; reason?: string }) {
    await this.cacheService.invalidatePattern(body.pattern);
    
    return {
      success: true,
      message: `Invalidated pattern: ${body.pattern}`
    };
  }

  // ==================== CACHE WARMUP ====================

  @Post('warmup')
  @UseGuards(JwtAuthGuard)
  async performWarmup() {
    await this.warmupService.performInitialWarmup();
    
    return {
      success: true,
      message: 'Cache warmup completed'
    };
  }

  @Post('warmup/user/:userId')
  @UseGuards(JwtAuthGuard)
  async warmupUserData(@Param('userId') userId: string) {
    await this.warmupService.warmupUserData(userId);
    
    return {
      success: true,
      message: `User data warmed up for: ${userId}`
    };
  }

  @Post('warmup/event/:eventId')
  @UseGuards(JwtAuthGuard)
  async warmupEventData(@Param('eventId') eventId: string) {
    await this.warmupService.warmupEventData(eventId);
    
    return {
      success: true,
      message: `Event data warmed up for: ${eventId}`
    };
  }

  @Post('warmup/popular')
  @UseGuards(JwtAuthGuard)
  async warmupPopularContent() {
    await this.warmupService.warmupPopularContent();
    
    return {
      success: true,
      message: 'Popular content warmed up'
    };
  }

  @Get('warmup/stats')
  @UseGuards(JwtAuthGuard)
  async getWarmupStats() {
    const stats = this.warmupService.getWarmupStats();
    
    return {
      success: true,
      data: stats
    };
  }

  // ==================== CACHE INVALIDATION ====================

  @Post('invalidate/entity')
  @UseGuards(JwtAuthGuard)
  async invalidateEntity(@Body() body: { entityType: string; entityId: string; reason?: string }) {
    await this.invalidationService.invalidateEntity(body.entityType, body.entityId, body.reason);
    
    return {
      success: true,
      message: `Invalidated ${body.entityType}:${body.entityId}`
    };
  }

  @Post('invalidate/user/:userId')
  @UseGuards(JwtAuthGuard)
  async invalidateUserCache(@Param('userId') userId: string, @Body('reason') reason?: string) {
    await this.invalidationService.invalidateUserCache(userId, reason);
    
    return {
      success: true,
      message: `Invalidated user cache for: ${userId}`
    };
  }

  @Post('invalidate/event/:eventId')
  @UseGuards(JwtAuthGuard)
  async invalidateEventCache(@Param('eventId') eventId: string, @Body('reason') reason?: string) {
    await this.invalidationService.invalidateEventCache(eventId, reason);
    
    return {
      success: true,
      message: `Invalidated event cache for: ${eventId}`
    };
  }

  @Post('invalidate/versioned')
  @UseGuards(JwtAuthGuard)
  async invalidateVersioned(@Body() body: { key: string; version: string; reason?: string }) {
    await this.invalidationService.invalidateVersioned(body.key, body.version, body.reason);
    
    return {
      success: true,
      message: `Versioned invalidation completed for: ${body.key}`
    };
  }

  @Get('invalidate/version/:key')
  @UseGuards(JwtAuthGuard)
  async getVersion(@Param('key') key: string) {
    const version = await this.invalidationService.getVersion(key);
    
    return {
      success: true,
      data: { key, version }
    };
  }

  // ==================== PERFORMANCE MONITORING ====================

  @Get('performance/metrics')
  @UseGuards(JwtAuthGuard)
  async getPerformanceMetrics() {
    const metrics = await this.performanceService.getMetrics();
    
    return {
      success: true,
      data: metrics
    };
  }

  @Get('performance/alerts')
  @UseGuards(JwtAuthGuard)
  async getPerformanceAlerts() {
    const alerts = this.performanceService.getAlerts();
    
    return {
      success: true,
      data: alerts
    };
  }

  @Get('performance/suggestions')
  @UseGuards(JwtAuthGuard)
  async getOptimizationSuggestions() {
    const suggestions = await this.performanceService.getOptimizationSuggestions();
    
    return {
      success: true,
      data: suggestions
    };
  }

  @Post('performance/optimize')
  @UseGuards(JwtAuthGuard)
  async optimizeCache() {
    await this.performanceService.optimizeCache();
    
    return {
      success: true,
      message: 'Cache optimization completed'
    };
  }

  @Get('performance/report')
  @UseGuards(JwtAuthGuard)
  async getPerformanceReport() {
    const report = await this.performanceService.getPerformanceReport();
    
    return {
      success: true,
      data: report
    };
  }

  // ==================== MULTI-LEVEL CACHE ====================

  @Get('multi-level/stats')
  @UseGuards(JwtAuthGuard)
  async getMultiLevelStats() {
    const stats = await this.multiLevelCache.getStats();
    
    return {
      success: true,
      data: stats
    };
  }

  @Post('multi-level/warmup')
  @UseGuards(JwtAuthGuard)
  async warmupMemoryCache(@Body() body: { keys: string[] }) {
    await this.multiLevelCache.warmupMemory(body.keys);
    
    return {
      success: true,
      message: `Warmed up ${body.keys.length} keys in memory cache`
    };
  }

  @Post('multi-level/clear-memory')
  @UseGuards(JwtAuthGuard)
  async clearMemoryCache() {
    this.multiLevelCache.clearMemory();
    
    return {
      success: true,
      message: 'Memory cache cleared'
    };
  }

  // ==================== SERIALIZATION ====================

  @Post('serialization/benchmark')
  @UseGuards(JwtAuthGuard)
  async benchmarkSerialization(@Body() body: { data: any }) {
    const benchmark = await this.serializationService.benchmark(body.data);
    
    return {
      success: true,
      data: benchmark
    };
  }

  @Post('serialization/optimize')
  @UseGuards(JwtAuthGuard)
  async getOptimalOptions(@Body() body: { data: any }) {
    const options = this.serializationService.getOptimalOptions(body.data);
    
    return {
      success: true,
      data: options
    };
  }

  // ==================== ANALYTICS ====================

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(@Query('timeRange') timeRange: 'hour' | 'day' | 'week' | 'month' = 'day') {
    const analytics = await this.analyticsService.getAnalytics(timeRange);
    
    return {
      success: true,
      data: analytics
    };
  }

  @Get('analytics/insights')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsInsights() {
    const insights = await this.analyticsService.getInsights();
    
    return {
      success: true,
      data: insights
    };
  }

  @Get('analytics/efficiency')
  @UseGuards(JwtAuthGuard)
  async getEfficiencyReport() {
    const efficiency = await this.analyticsService.getEfficiencyReport();
    
    return {
      success: true,
      data: efficiency
    };
  }

  @Get('analytics/hit-ratio')
  @UseGuards(JwtAuthGuard)
  async getHitRatioByPattern(@Body() body: { patterns: string[] }) {
    const hitRatios = await this.analyticsService.getHitRatioByPattern(body.patterns);
    
    return {
      success: true,
      data: hitRatios
    };
  }

  @Post('analytics/export')
  @UseGuards(JwtAuthGuard)
  async exportAnalytics(@Body() body: { format: 'json' | 'csv' | 'excel' }) {
    const exportData = await this.analyticsService.exportAnalytics(body.format);
    
    return {
      success: true,
      data: exportData
    };
  }

  // ==================== FALLBACK ====================

  @Get('fallback/health')
  @UseGuards(JwtAuthGuard)
  async getFallbackHealth() {
    const health = await this.fallbackService.healthCheck();
    
    return {
      success: true,
      data: health
    };
  }

  @Get('fallback/stats')
  @UseGuards(JwtAuthGuard)
  async getFallbackStats() {
    const stats = await this.fallbackService.getFallbackStats();
    
    return {
      success: true,
      data: stats
    };
  }

  @Post('fallback/test')
  @UseGuards(JwtAuthGuard)
  async testFallbacks() {
    const testResults = await this.fallbackService.testFallbacks();
    
    return {
      success: true,
      data: testResults
    };
  }

  @Post('fallback/configure')
  @UseGuards(JwtAuthGuard)
  async configureFallbacks(@Body() body: {
    memoryFallback?: boolean;
    databaseFallback?: boolean;
    staleDataFallback?: boolean;
  }) {
    this.fallbackService.configureFallbacks(body);
    
    return {
      success: true,
      message: 'Fallback mechanisms configured'
    };
  }

  // ==================== COMPREHENSIVE DASHBOARD ====================

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboardData() {
    const [
      cacheStats,
      performanceMetrics,
      analytics,
      fallbackHealth,
      multiLevelStats
    ] = await Promise.all([
      this.cacheService.getStats(),
      this.performanceService.getMetrics(),
      this.analyticsService.getAnalytics(),
      this.fallbackService.healthCheck(),
      this.multiLevelCache.getStats()
    ]);

    return {
      success: true,
      data: {
        cache: cacheStats,
        performance: performanceMetrics,
        analytics,
        fallback: fallbackHealth,
        multiLevel: multiLevelStats,
        timestamp: new Date()
      }
    };
  }

  @Post('maintenance/optimize-all')
  @UseGuards(JwtAuthGuard)
  async performFullOptimization() {
    const results = await Promise.allSettled([
      this.performanceService.optimizeCache(),
      this.warmupService.performInitialWarmup(),
      this.multiLevelCache.warmupMemory(['user:*', 'events:popular', 'categories:*'])
    ]);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: failed === 0,
      message: `Optimization completed: ${successful} successful, ${failed} failed`,
      details: {
        successful,
        failed,
        total: results.length
      }
    };
  }
}
