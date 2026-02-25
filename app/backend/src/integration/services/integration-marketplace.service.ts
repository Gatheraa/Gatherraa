import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplacePlugin, PluginType, PluginStatus, PricingModel } from '../entities/marketplace-plugin.entity';

@Injectable()
export class IntegrationMarketplaceService {
  private readonly logger = new Logger(IntegrationMarketplaceService.name);

  constructor(
    @InjectRepository(MarketplacePlugin)
    private readonly marketplacePluginRepository: Repository<MarketplacePlugin>,
  ) {}

  async createPlugin(pluginData: Partial<MarketplacePlugin>): Promise<MarketplacePlugin> {
    this.logger.log(`Creating new marketplace plugin: ${pluginData.name}`);

    const plugin = this.marketplacePluginRepository.create(pluginData);
    return await this.marketplacePluginRepository.save(plugin);
  }

  async getPlugins(filters?: {
    type?: PluginType;
    status?: PluginStatus;
    featured?: boolean;
    verified?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ plugins: MarketplacePlugin[]; total: number }> {
    const { type, status, featured, verified, search, page = 1, limit = 20 } = filters || {};

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (featured !== undefined) where.isFeatured = featured;
    if (verified !== undefined) where.isVerified = verified;
    if (search) {
      where.name = { $like: `%${search}%` };
    }

    const [plugins, total] = await this.marketplacePluginRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { 
        isFeatured: 'DESC',
        rating: 'DESC',
        downloads: 'DESC',
        createdAt: 'DESC'
      },
    });

    return { plugins, total };
  }

  async getPlugin(pluginId: string): Promise<MarketplacePlugin> {
    const plugin = await this.marketplacePluginRepository.findOne({ where: { id: pluginId } });
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    return plugin;
  }

  async getPluginBySlug(slug: string): Promise<MarketplacePlugin> {
    const plugin = await this.marketplacePluginRepository.findOne({ where: { slug } });
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${slug}`);
    }

    return plugin;
  }

  async updatePlugin(pluginId: string, updates: Partial<MarketplacePlugin>): Promise<MarketplacePlugin> {
    const plugin = await this.getPlugin(pluginId);
    
    Object.assign(plugin, updates);
    return await this.marketplacePluginRepository.save(plugin);
  }

  async deletePlugin(pluginId: string): Promise<void> {
    const result = await this.marketplacePluginRepository.delete(pluginId);
    
    if (result.affected === 0) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
  }

  async installPlugin(pluginId: string, integrationId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Installing plugin ${pluginId} for integration ${integrationId}`);

    const plugin = await this.getPlugin(pluginId);

    if (plugin.status !== PluginStatus.PUBLISHED) {
      return { success: false, message: 'Plugin is not available for installation' };
    }

    try {
      // Increment install count
      plugin.installCount++;
      plugin.activeInstallCount++;
      await this.marketplacePluginRepository.save(plugin);

      // This would trigger the actual installation process
      // For now, we'll just log the installation
      this.logger.log(`Plugin ${plugin.name} installed successfully for integration ${integrationId}`);

      return { success: true, message: 'Plugin installed successfully' };
    } catch (error) {
      this.logger.error(`Failed to install plugin ${pluginId}: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async uninstallPlugin(pluginId: string, integrationId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Uninstalling plugin ${pluginId} from integration ${integrationId}`);

    const plugin = await this.getPlugin(pluginId);

    try {
      // Decrement active install count
      if (plugin.activeInstallCount > 0) {
        plugin.activeInstallCount--;
        await this.marketplacePluginRepository.save(plugin);
      }

      // This would trigger the actual uninstallation process
      // For now, we'll just log the uninstallation
      this.logger.log(`Plugin ${plugin.name} uninstalled successfully from integration ${integrationId}`);

      return { success: true, message: 'Plugin uninstalled successfully' };
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async ratePlugin(pluginId: string, rating: number, review?: string): Promise<{ success: boolean; message: string }> {
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' };
    }

    const plugin = await this.getPlugin(pluginId);

    // Update rating (simplified - in reality, you'd store individual reviews)
    const totalRating = plugin.rating * plugin.reviewCount + rating;
    plugin.reviewCount++;
    plugin.rating = totalRating / plugin.reviewCount;

    await this.marketplacePluginRepository.save(plugin);

    return { success: true, message: 'Rating submitted successfully' };
  }

  async getFeaturedPlugins(limit: number = 10): Promise<MarketplacePlugin[]> {
    return await this.marketplacePluginRepository.find({
      where: { 
        isFeatured: true,
        status: PluginStatus.PUBLISHED 
      },
      take: limit,
      order: { rating: 'DESC' },
    });
  }

  async getPopularPlugins(limit: number = 10): Promise<MarketplacePlugin[]> {
    return await this.marketplacePluginRepository.find({
      where: { status: PluginStatus.PUBLISHED },
      take: limit,
      order: { downloads: 'DESC' },
    });
  }

  async getPluginsByType(type: PluginType, limit: number = 20): Promise<MarketplacePlugin[]> {
    return await this.marketplacePluginRepository.find({
      where: { 
        type,
        status: PluginStatus.PUBLISHED 
      },
      take: limit,
      order: { rating: 'DESC' },
    });
  }

  async searchPlugins(query: string, filters?: {
    type?: PluginType;
    pricingModel?: PricingModel;
    verified?: boolean;
  }): Promise<{ plugins: MarketplacePlugin[]; total: number }> {
    const where: any = {
      status: PluginStatus.PUBLISHED,
      $or: [
        { name: { $like: `%${query}%` } },
        { description: { $like: `%${query}%` } },
        { tags: { $like: `%${query}%` } },
      ],
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.pricingModel) where.pricingModel = filters.pricingModel;
    if (filters?.verified !== undefined) where.isVerified = filters.verified;

    const [plugins, total] = await this.marketplacePluginRepository.findAndCount({
      where,
      order: { rating: 'DESC' },
    });

    return { plugins, total };
  }

  async validatePlugin(pluginData: Partial<MarketplacePlugin>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Required fields
    if (!pluginData.name || pluginData.name.trim().length === 0) {
      errors.push('Plugin name is required');
    }

    if (!pluginData.description || pluginData.description.trim().length === 0) {
      errors.push('Plugin description is required');
    }

    if (!pluginData.slug || pluginData.slug.trim().length === 0) {
      errors.push('Plugin slug is required');
    } else if (!/^[a-z0-9-]+$/.test(pluginData.slug)) {
      errors.push('Plugin slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (!pluginData.author || pluginData.author.trim().length === 0) {
      errors.push('Plugin author is required');
    }

    if (!pluginData.type) {
      errors.push('Plugin type is required');
    }

    if (!pluginData.version || pluginData.version.trim().length === 0) {
      errors.push('Plugin version is required');
    }

    // Validate configuration schema
    if (pluginData.configurationSchema && typeof pluginData.configurationSchema !== 'object') {
      errors.push('Configuration schema must be a valid object');
    }

    // Validate authentication schema
    if (pluginData.authenticationSchema && typeof pluginData.authenticationSchema !== 'object') {
      errors.push('Authentication schema must be a valid object');
    }

    // Check for unique slug
    if (pluginData.slug) {
      const existingPlugin = await this.marketplacePluginRepository.findOne({
        where: { slug: pluginData.slug }
      });
      
      if (existingPlugin && existingPlugin.id !== pluginData.id) {
        errors.push('Plugin slug must be unique');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getPluginStats(): Promise<{
    totalPlugins: number;
    publishedPlugins: number;
    draftPlugins: number;
    totalDownloads: number;
    averageRating: number;
    pluginsByType: Record<PluginType, number>;
    pluginsByPricingModel: Record<PricingModel, number>;
  }> {
    const [
      totalPlugins,
      publishedPlugins,
      draftPlugins,
      pluginsByType,
      pluginsByPricingModel,
    ] = await Promise.all([
      this.marketplacePluginRepository.count(),
      this.marketplacePluginRepository.count({ where: { status: PluginStatus.PUBLISHED } }),
      this.marketplacePluginRepository.count({ where: { status: PluginStatus.DRAFT } }),
      this.getPluginCountByType(),
      this.getPluginCountByPricingModel(),
    ]);

    const plugins = await this.marketplacePluginRepository.find({
      where: { status: PluginStatus.PUBLISHED },
      select: ['downloads', 'rating'],
    });

    const totalDownloads = plugins.reduce((sum, plugin) => sum + plugin.downloads, 0);
    const averageRating = plugins.length > 0 
      ? plugins.reduce((sum, plugin) => sum + plugin.rating, 0) / plugins.length 
      : 0;

    return {
      totalPlugins,
      publishedPlugins,
      draftPlugins,
      totalDownloads,
      averageRating: Math.round(averageRating * 100) / 100,
      pluginsByType,
      pluginsByPricingModel,
    };
  }

  private async getPluginCountByType(): Promise<Record<PluginType, number>> {
    const result = await this.marketplacePluginRepository
      .createQueryBuilder('plugin')
      .select('plugin.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('plugin.type')
      .getRawMany();

    const counts = {} as Record<PluginType, number>;
    
    Object.values(PluginType).forEach(type => {
      counts[type] = 0;
    });

    result.forEach(item => {
      counts[item.type as PluginType] = parseInt(item.count);
    });

    return counts;
  }

  private async getPluginCountByPricingModel(): Promise<Record<PricingModel, number>> {
    const result = await this.marketplacePluginRepository
      .createQueryBuilder('plugin')
      .select('plugin.pricingModel', 'pricingModel')
      .addSelect('COUNT(*)', 'count')
      .groupBy('plugin.pricingModel')
      .getRawMany();

    const counts = {} as Record<PricingModel, number>;
    
    Object.values(PricingModel).forEach(model => {
      counts[model] = 0;
    });

    result.forEach(item => {
      counts[item.pricingModel as PricingModel] = parseInt(item.count);
    });

    return counts;
  }
}
