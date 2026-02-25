import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataMappingRule, MappingType, TransformationType } from '../entities/data-mapping-rule.entity';
import { Integration } from '../entities/integration.entity';

@Injectable()
export class DataMappingService {
  private readonly logger = new Logger(DataMappingService.name);

  constructor(
    @InjectRepository(DataMappingRule)
    private readonly dataMappingRuleRepository: Repository<DataMappingRule>,
  ) {}

  async transformData(
    integrationId: string,
    sourceData: any,
    targetSchema?: Record<string, any>,
  ): Promise<any> {
    this.logger.log(`Transforming data for integration ${integrationId}`);

    const mappingRules = await this.getMappingRules(integrationId);
    
    if (mappingRules.length === 0) {
      this.logger.warn(`No mapping rules found for integration ${integrationId}`);
      return sourceData;
    }

    const transformedData: any = {};

    // Sort rules by priority
    const sortedRules = mappingRules.sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        const value = this.extractValue(sourceData, rule.sourceField);
        const transformedValue = await this.applyTransformation(rule, value, sourceData);
        
        if (transformedValue !== null && transformedValue !== undefined) {
          this.setValue(transformedData, rule.targetField, transformedValue);
        } else if (rule.defaultValue !== null && rule.defaultValue !== undefined) {
          this.setValue(transformedData, rule.targetField, rule.defaultValue);
        } else if (rule.isRequired) {
          throw new Error(`Required field ${rule.targetField} is missing and has no default value`);
        }
      } catch (error) {
        this.logger.error(`Error applying mapping rule ${rule.name}: ${error.message}`);
        
        if (rule.isRequired) {
          throw error;
        }
        
        // Continue processing other rules for non-required fields
      }
    }

    // Apply target schema validation if provided
    if (targetSchema) {
      this.validateAgainstSchema(transformedData, targetSchema);
    }

    return transformedData;
  }

  async createMappingRule(integrationId: string, ruleData: Partial<DataMappingRule>): Promise<DataMappingRule> {
    this.logger.log(`Creating mapping rule for integration ${integrationId}`);

    const rule = this.dataMappingRuleRepository.create({
      ...ruleData,
      integrationId,
    });

    return await this.dataMappingRuleRepository.save(rule);
  }

  async updateMappingRule(ruleId: string, updates: Partial<DataMappingRule>): Promise<DataMappingRule> {
    this.logger.log(`Updating mapping rule: ${ruleId}`);

    const rule = await this.dataMappingRuleRepository.findOne({ where: { id: ruleId } });
    
    if (!rule) {
      throw new Error(`Mapping rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates);
    return await this.dataMappingRuleRepository.save(rule);
  }

  async deleteMappingRule(ruleId: string): Promise<void> {
    this.logger.log(`Deleting mapping rule: ${ruleId}`);

    const result = await this.dataMappingRuleRepository.delete(ruleId);
    
    if (result.affected === 0) {
      throw new Error(`Mapping rule not found: ${ruleId}`);
    }
  }

  async getMappingRules(integrationId: string): Promise<DataMappingRule[]> {
    return await this.dataMappingRuleRepository.find({
      where: { integrationId, isActive: true },
      order: { priority: 'ASC' },
    });
  }

  async getMappingRule(ruleId: string): Promise<DataMappingRule> {
    const rule = await this.dataMappingRuleRepository.findOne({ where: { id: ruleId } });
    
    if (!rule) {
      throw new Error(`Mapping rule not found: ${ruleId}`);
    }

    return rule;
  }

  async testMappingRule(ruleId: string, testData: any): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const rule = await this.getMappingRule(ruleId);
      const value = this.extractValue(testData, rule.sourceField);
      const result = await this.applyTransformation(rule, value, testData);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async bulkTransformData(
    integrationId: string,
    dataArray: any[],
    targetSchema?: Record<string, any>,
  ): Promise<any[]> {
    this.logger.log(`Bulk transforming ${dataArray.length} records for integration ${integrationId}`);

    const mappingRules = await this.getMappingRules(integrationId);
    
    if (mappingRules.length === 0) {
      return dataArray;
    }

    const results: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < dataArray.length; i++) {
      try {
        const transformed = await this.transformData(integrationId, dataArray[i], targetSchema);
        results.push(transformed);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
        });
        this.logger.error(`Error transforming record ${i}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Failed to transform ${errors.length} out of ${dataArray.length} records`);
    }

    return results;
  }

  async generateMappingSchema(
    integrationId: string,
    sampleSourceData: any[],
    sampleTargetData?: any[],
  ): Promise<{
    suggestedRules: Partial<DataMappingRule>[];
    confidence: number;
  }> {
    this.logger.log(`Generating mapping schema for integration ${integrationId}`);

    const suggestedRules: Partial<DataMappingRule>[] = [];
    const sourceFields = this.extractFields(sampleSourceData);
    const targetFields = sampleTargetData ? this.extractFields(sampleTargetData) : [];

    // Simple field name matching for suggestions
    for (const sourceField of sourceFields) {
      const bestMatch = this.findBestMatch(sourceField, targetFields);
      
      if (bestMatch && bestMatch.confidence > 0.7) {
        suggestedRules.push({
          name: `${sourceField} -> ${bestMatch.field}`,
          description: `Auto-mapped ${sourceField} to ${bestMatch.field}`,
          sourceField,
          targetField: bestMatch.field,
          mappingType: MappingType.FIELD,
          transformationType: TransformationType.DIRECT,
          priority: suggestedRules.length,
        });
      }
    }

    const confidence = suggestedRules.length / Math.max(sourceFields.length, 1);

    return {
      suggestedRules,
      confidence,
    };
  }

  private extractValue(data: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array access
      if (part.includes('[') && part.includes(']')) {
        const [fieldName, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current[fieldName]?.[index];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  private setValue(target: any, fieldPath: string, value: any): void {
    const parts = fieldPath.split('.');
    let current = target;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  private async applyTransformation(
    rule: DataMappingRule,
    value: any,
    fullSourceData: any,
  ): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    switch (rule.transformationType) {
      case TransformationType.DIRECT:
        return value;

      case TransformationType.FORMAT_DATE:
        return this.formatDate(value, rule.transformationConfig);

      case TransformationType.FORMAT_NUMBER:
        return this.formatNumber(value, rule.transformationConfig);

      case TransformationType.CONCATENATE:
        return this.concatenate(value, rule.transformationConfig, fullSourceData);

      case TransformationType.SPLIT:
        return this.split(value, rule.transformationConfig);

      case TransformationType.CONDITIONAL:
        return this.applyConditional(value, rule.transformationConfig, fullSourceData);

      case TransformationType.LOOKUP:
        return this.applyLookup(value, rule.transformationConfig);

      case TransformationType.FUNCTION:
        return this.applyCustomFunction(value, rule.transformationConfig, fullSourceData);

      default:
        return value;
    }
  }

  private formatDate(value: any, config?: any): string {
    if (!value) return value;
    
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const format = config?.format || 'ISO';
    
    switch (format) {
      case 'ISO':
        return date.toISOString();
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[0];
      case 'timestamp':
        return date.getTime().toString();
      default:
        return date.toISOString();
    }
  }

  private formatNumber(value: any, config?: any): number | string {
    const num = Number(value);
    if (isNaN(num)) return value;

    if (config?.decimals !== undefined) {
      return num.toFixed(config.decimals);
    }

    return num;
  }

  private concatenate(value: any, config?: any, fullSourceData?: any): string {
    const parts = config?.parts || [];
    const result = [];

    for (const part of parts) {
      if (part.type === 'literal') {
        result.push(part.value);
      } else if (part.type === 'field') {
        const fieldValue = this.extractValue(fullSourceData, part.field);
        result.push(fieldValue);
      } else if (part.type === 'current') {
        result.push(value);
      }
    }

    return result.join(config?.separator || '');
  }

  private split(value: any, config?: any): string[] {
    if (typeof value !== 'string') return [value];
    
    const separator = config?.separator || ',';
    return value.split(separator).map(part => part.trim());
  }

  private applyConditional(value: any, config?: any, fullSourceData?: any): any {
    const conditions = config?.conditions || [];
    
    for (const condition of conditions) {
      const testValue = condition.source === 'field' 
        ? this.extractValue(fullSourceData, condition.field)
        : value;

      if (this.evaluateCondition(testValue, condition)) {
        return condition.value;
      }
    }

    return config?.defaultValue || value;
  }

  private applyLookup(value: any, config?: any): any {
    const lookupTable = config?.table || {};
    return lookupTable[value] ?? config?.defaultValue;
  }

  private applyCustomFunction(value: any, config?: any, fullSourceData?: any): any {
    // This would implement custom function execution
    // For security reasons, this should be carefully implemented
    // For now, return the original value
    return value;
  }

  private evaluateCondition(value: any, condition: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.operand;
      case 'not_equals':
        return value !== condition.operand;
      case 'greater_than':
        return Number(value) > Number(condition.operand);
      case 'less_than':
        return Number(value) < Number(condition.operand);
      case 'contains':
        return String(value).includes(String(condition.operand));
      case 'regex':
        return new RegExp(condition.operand).test(String(value));
      default:
        return false;
    }
  }

  private extractFields(dataArray: any[]): string[] {
    const fields = new Set<string>();

    for (const data of dataArray) {
      this.extractFieldsRecursive(data, '', fields);
    }

    return Array.from(fields);
  }

  private extractFieldsRecursive(obj: any, prefix: string, fields: Set<string>): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key in obj) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fields.add(fieldPath);
        this.extractFieldsRecursive(obj[key], fieldPath, fields);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const fieldPath = `${prefix}[${index}]`;
        this.extractFieldsRecursive(item, fieldPath, fields);
      });
    }
  }

  private findBestMatch(sourceField: string, targetFields: string[]): { field: string; confidence: number } | null {
    let bestMatch: { field: string; confidence: number } | null = null;

    for (const targetField of targetFields) {
      const confidence = this.calculateFieldMatch(sourceField, targetField);
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { field: targetField, confidence };
      }
    }

    return bestMatch;
  }

  private calculateFieldMatch(field1: string, field2: string): number {
    // Simple string similarity calculation
    const f1 = field1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const f2 = field2.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (f1 === f2) return 1.0;
    if (f1.includes(f2) || f2.includes(f1)) return 0.8;

    // Levenshtein distance simplified
    const distance = this.levenshteinDistance(f1, f2);
    const maxLength = Math.max(f1.length, f2.length);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private validateAgainstSchema(data: any, schema: Record<string, any>): void {
    // Basic schema validation
    for (const [field, rules] of Object.entries(schema)) {
      const value = this.extractValue(data, field);
      
      if (rules.required && (value === null || value === undefined)) {
        throw new Error(`Required field ${field} is missing`);
      }

      if (value !== null && value !== undefined) {
        if (rules.type && typeof value !== rules.type) {
          throw new Error(`Field ${field} must be of type ${rules.type}`);
        }

        if (rules.min !== undefined && value < rules.min) {
          throw new Error(`Field ${field} must be at least ${rules.min}`);
        }

        if (rules.max !== undefined && value > rules.max) {
          throw new Error(`Field ${field} must be at most ${rules.max}`);
        }

        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          throw new Error(`Field ${field} does not match required pattern`);
        }
      }
    }
  }
}
