import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey, ApiTier } from '../entities/api-key.entity';
import { ApiQuota, QuotaPeriod } from '../entities/api-quota.entity';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'weighted' | 'least-connections';
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
}

export interface ServerNode {
  id: string;
  url: string;
  weight: number;
  isActive: boolean;
  connections: number;
  lastHealthCheck: Date;
  responseTime: number;
}

export interface RoutingRule {
  pattern: string;
  method: string;
  priority: number;
  targetServers: string[];
  conditions?: Record<string, any>;
}

@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  private serverNodes: Map<string, ServerNode> = new Map();
  private routingRules: RoutingRule[] = [];
  private config: LoadBalancerConfig;

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(ApiQuota)
    private quotaRepository: Repository<ApiQuota>,
  ) {
    this.config = {
      algorithm: 'weighted',
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      timeout: 5000
    };

    this.initializeServerNodes();
    this.initializeRoutingRules();
  }

  /**
   * Route request to appropriate server
   */
  async routeRequest(
    apiKeyId: string,
    endpoint: string,
    method: string,
    payload?: any
  ): Promise<{
    targetUrl: string;
    retries: number;
    timeout: number;
  }> {
    // Check if API key has access to the endpoint
    const hasAccess = await this.checkEndpointAccess(apiKeyId, endpoint, method);
    if (!hasAccess) {
      throw new Error('Access denied to endpoint');
    }

    // Find matching routing rule
    const rule = this.findRoutingRule(endpoint, method);
    
    // Select server based on load balancing algorithm
    const targetServer = await this.selectServer(
      rule ? rule.targetServers : this.getActiveServerIds()
    );

    if (!targetServer) {
      throw new Error('No available servers');
    }

    // Increment connection count
    await this.incrementConnections(targetServer.id);

    return {
      targetUrl: targetServer.url,
      retries: this.config.maxRetries,
      timeout: this.config.timeout
    };
  }

  /**
   * Add a new server node
   */
  async addServerNode(node: Omit<ServerNode, 'connections' | 'lastHealthCheck' | 'responseTime'>): Promise<void> {
    const serverNode: ServerNode = {
      ...node,
      connections: 0,
      lastHealthCheck: new Date(),
      responseTime: 0
    };

    this.serverNodes.set(node.id, serverNode);
    await this.saveServerNodeToRedis(serverNode);
    
    this.logger.log(`Added server node: ${node.id} (${node.url})`);
  }

  /**
   * Remove a server node
   */
  async removeServerNode(nodeId: string): Promise<void> {
    this.serverNodes.delete(nodeId);
    await this.removeServerNodeFromRedis(nodeId);
    
    this.logger.log(`Removed server node: ${nodeId}`);
  }

  /**
   * Add routing rule
   */
  async addRoutingRule(rule: RoutingRule): Promise<void> {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
    await this.saveRoutingRulesToRedis();
    
    this.logger.log(`Added routing rule: ${rule.pattern} (${rule.method})`);
  }

  /**
   * Perform health check on all server nodes
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.serverNodes.values()).map(
      node => this.checkNodeHealth(node)
    );

    const results = await Promise.allSettled(healthCheckPromises);
    
    results.forEach((result, index) => {
      const node = Array.from(this.serverNodes.values())[index];
      if (result.status === 'fulfilled') {
        node.isActive = result.value.isHealthy;
        node.responseTime = result.value.responseTime;
        node.lastHealthCheck = new Date();
      } else {
        this.logger.error(`Health check failed for node ${node.id}:`, result.reason);
        node.isActive = false;
        node.lastHealthCheck = new Date();
      }
    });

    await this.saveServerNodesToRedis();
  }

  /**
   * Get gateway statistics
   */
  async getGatewayStatistics(): Promise<{
    totalNodes: number;
    activeNodes: number;
    totalConnections: number;
    averageResponseTime: number;
    routingRules: number;
    requestsPerMinute: number;
  }> {
    const nodes = Array.from(this.serverNodes.values());
    const activeNodes = nodes.filter(n => n.isActive);
    const totalConnections = nodes.reduce((sum, n) => sum + n.connections, 0);
    const averageResponseTime = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.responseTime, 0) / nodes.length 
      : 0;

    // Get requests per minute from Redis
    const rpm = await this.redis.get('gateway:rpm') || '0';

    return {
      totalNodes: nodes.length,
      activeNodes: activeNodes.length,
      totalConnections,
      averageResponseTime,
      routingRules: this.routingRules.length,
      requestsPerMinute: parseInt(rpm)
    };
  }

  /**
   * Get load balancing recommendations
   */
  async getLoadBalancingRecommendations(): Promise<{
    addNodes: string[];
    removeNodes: string[];
    adjustWeights: Array<{ nodeId: string; currentWeight: number; recommendedWeight: number }>;
  }> {
    const nodes = Array.from(this.serverNodes.values());
    const activeNodes = nodes.filter(n => n.isActive);
    const totalConnections = activeNodes.reduce((sum, n) => sum + n.connections, 0);
    const avgConnectionsPerNode = totalConnections / activeNodes.length;

    const recommendations = {
      addNodes: [] as string[],
      removeNodes: [] as string[],
      adjustWeights: [] as Array<{ nodeId: string; currentWeight: number; recommendedWeight: number }>
    };

    // Check if we need more nodes
    if (avgConnectionsPerNode > 1000) { // Threshold for adding nodes
      const nodesToAdd = Math.ceil(avgConnectionsPerNode / 1000) - activeNodes.length;
      for (let i = 0; i < nodesToAdd; i++) {
        recommendations.addNodes.push(`new-node-${i + 1}`);
      }
    }

    // Check for underutilized nodes
    activeNodes.forEach(node => {
      if (node.connections < avgConnectionsPerNode * 0.3) { // Less than 30% of average
        recommendations.removeNodes.push(node.id);
      }

      // Weight adjustments
      const idealWeight = (node.connections / totalConnections) * 100;
      if (Math.abs(node.weight - idealWeight) > 10) { // More than 10% difference
        recommendations.adjustWeights.push({
          nodeId: node.id,
          currentWeight: node.weight,
          recommendedWeight: Math.round(idealWeight)
        });
      }
    });

    return recommendations;
  }

  /**
   * Initialize default server nodes
   */
  private initializeServerNodes(): void {
    const defaultNodes: ServerNode[] = [
      {
        id: 'node-1',
        url: process.env.API_SERVER_1 || 'http://localhost:3001',
        weight: 33,
        isActive: true,
        connections: 0,
        lastHealthCheck: new Date(),
        responseTime: 0
      },
      {
        id: 'node-2',
        url: process.env.API_SERVER_2 || 'http://localhost:3002',
        weight: 33,
        isActive: true,
        connections: 0,
        lastHealthCheck: new Date(),
        responseTime: 0
      },
      {
        id: 'node-3',
        url: process.env.API_SERVER_3 || 'http://localhost:3003',
        weight: 34,
        isActive: true,
        connections: 0,
        lastHealthCheck: new Date(),
        responseTime: 0
      }
    ];

    defaultNodes.forEach(node => {
      this.serverNodes.set(node.id, node);
    });
  }

  /**
   * Initialize default routing rules
   */
  private initializeRoutingRules(): void {
    this.routingRules = [
      {
        pattern: '/api/v1/analytics/*',
        method: 'GET',
        priority: 1,
        targetServers: ['node-1', 'node-2'],
        conditions: { tier: ['PROFESSIONAL', 'ENTERPRISE'] }
      },
      {
        pattern: '/api/v1/reports/*',
        method: 'POST',
        priority: 2,
        targetServers: ['node-2', 'node-3'],
        conditions: { tier: ['ENTERPRISE'] }
      },
      {
        pattern: '/api/v1/admin/*',
        method: '*',
        priority: 3,
        targetServers: ['node-3'],
        conditions: { tier: ['ENTERPRISE'] }
      }
    ];

    this.routingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if API key has access to endpoint
   */
  private async checkEndpointAccess(
    apiKeyId: string,
    endpoint: string,
    method: string
  ): Promise<boolean> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId }
    });

    if (!apiKey) {
      return false;
    }

    // Simple permission check
    const requiredPermission = this.getRequiredPermission(endpoint, method);
    return apiKey.permissions.includes(requiredPermission);
  }

  /**
   * Find matching routing rule
   */
  private findRoutingRule(endpoint: string, method: string): RoutingRule | null {
    return this.routingRules.find(rule => 
      this.matchesPattern(endpoint, rule.pattern) && 
      (rule.method === '*' || rule.method === method)
    ) || null;
  }

  /**
   * Check if endpoint matches pattern
   */
  private matchesPattern(endpoint: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(endpoint);
  }

  /**
   * Select server based on load balancing algorithm
   */
  private async selectServer(availableServers: string[]): Promise<ServerNode | null> {
    const activeNodes = Array.from(this.serverNodes.values())
      .filter(node => 
        availableServers.includes(node.id) && node.isActive
      );

    if (activeNodes.length === 0) {
      return null;
    }

    switch (this.config.algorithm) {
      case 'round-robin':
        return this.selectRoundRobin(activeNodes);
      
      case 'weighted':
        return this.selectWeighted(activeNodes);
      
      case 'least-connections':
        return this.selectLeastConnections(activeNodes);
      
      default:
        return activeNodes[0];
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(nodes: ServerNode[]): ServerNode {
    const key = 'gateway:round-robin-index';
    const currentIndex = parseInt(await this.redis.get(key) || '0');
    const nextIndex = currentIndex % nodes.length;
    
    await this.redis.set(key, (nextIndex + 1).toString());
    return nodes[nextIndex];
  }

  /**
   * Weighted selection
   */
  private selectWeighted(nodes: ServerNode[]): ServerNode {
    const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const node of nodes) {
      currentWeight += node.weight;
      if (random <= currentWeight) {
        return node;
      }
    }
    
    return nodes[0];
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(nodes: ServerNode[]): ServerNode {
    return nodes.reduce((min, node) => 
      node.connections < min.connections ? node : min
    );
  }

  /**
   * Check node health
   */
  private async checkNodeHealth(node: ServerNode): Promise<{
    isHealthy: boolean;
    responseTime: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple health check - in production, implement proper health check
      const response = await fetch(`${node.url}/health`, {
        method: 'GET',
        timeout: this.config.timeout
      });
      
      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < this.config.timeout;
      
      return { isHealthy, responseTime };
    } catch (error) {
      return { isHealthy: false, responseTime: this.config.timeout };
    }
  }

  /**
   * Increment connection count
   */
  private async incrementConnections(nodeId: string): Promise<void> {
    const node = this.serverNodes.get(nodeId);
    if (node) {
      node.connections++;
      await this.redis.incr(`gateway:connections:${nodeId}`);
    }
  }

  /**
   * Get active server IDs
   */
  private getActiveServerIds(): string[] {
    return Array.from(this.serverNodes.values())
      .filter(node => node.isActive)
      .map(node => node.id);
  }

  /**
   * Get required permission for endpoint
   */
  private getRequiredPermission(endpoint: string, method: string): string {
    if (endpoint.startsWith('/api/v1/analytics')) {
      return 'analytics:read';
    }
    if (endpoint.startsWith('/api/v1/reports')) {
      return method === 'GET' ? 'reports:read' : 'reports:write';
    }
    if (endpoint.startsWith('/api/v1/admin')) {
      return 'admin:access';
    }
    return 'api:access';
  }

  /**
   * Save server node to Redis
   */
  private async saveServerNodeToRedis(node: ServerNode): Promise<void> {
    await this.redis.hset(
      'gateway:nodes',
      node.id,
      JSON.stringify(node)
    );
  }

  /**
   * Save all server nodes to Redis
   */
  private async saveServerNodesToRedis(): Promise<void> {
    const nodesData = {};
    this.serverNodes.forEach((node, id) => {
      nodesData[id] = JSON.stringify(node);
    });
    await this.redis.hmset('gateway:nodes', nodesData);
  }

  /**
   * Remove server node from Redis
   */
  private async removeServerNodeFromRedis(nodeId: string): Promise<void> {
    await this.redis.hdel('gateway:nodes', nodeId);
  }

  /**
   * Save routing rules to Redis
   */
  private async saveRoutingRulesToRedis(): Promise<void> {
    await this.redis.set(
      'gateway:routing-rules',
      JSON.stringify(this.routingRules)
    );
  }
}
