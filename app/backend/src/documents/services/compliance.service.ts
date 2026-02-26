import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentCategory, DocumentType } from '../entities/document.entity';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'privacy' | 'financial' | 'legal' | 'quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  conditions: {
    documentTypes?: DocumentType[];
    categories?: DocumentCategory[];
    fileSizes?: {
      min?: number;
      max?: number;
    };
    contentPatterns?: Array<{
      type: 'regex' | 'keyword' | 'entity';
      pattern: string;
      required: boolean;
    }>;
    metadataRequirements?: Array<{
      field: string;
      type: 'required' | 'recommended';
      condition?: string;
    }>;
  };
  actions: Array<{
    type: 'block' | 'flag' | 'require_approval' | 'notify' | 'encrypt';
    parameters?: Record<string, any>;
  }>;
}

export interface ComplianceCheckResult {
  documentId: string;
  ruleId: string;
  ruleName: string;
  status: 'passed' | 'failed' | 'warning' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    message: string;
    violations?: Array<{
      type: string;
      description: string;
      location?: string;
    }>;
    recommendations?: string[];
    metadata?: Record<string, any>;
  };
  timestamp: Date;
  processingTime: number;
}

export interface ComplianceReport {
  documentId: string;
  overallStatus: 'compliant' | 'non_compliant' | 'requires_review';
  score: number; // 0-100
  checks: ComplianceCheckResult[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  recommendations: string[];
  generatedAt: Date;
  expiresAt?: Date;
}

export interface ComplianceOptions {
  categories?: Array<'security' | 'privacy' | 'financial' | 'legal' | 'quality'>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  includeDisabled?: boolean;
  customRules?: ComplianceRule[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private readonly defaultRules: ComplianceRule[] = [];

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
  ) {
    this.initializeDefaultRules();
  }

  async checkDocumentCompliance(
    documentId: string,
    options: ComplianceOptions = {}
  ): Promise<ComplianceReport> {
    const startTime = Date.now();
    
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Get applicable rules
      const rules = this.getApplicableRules(document, options);
      
      // Run compliance checks
      const checks: ComplianceCheckResult[] = [];
      
      for (const rule of rules) {
        const checkResult = await this.evaluateRule(document, rule);
        checks.push(checkResult);
      }

      // Generate compliance report
      const report = this.generateComplianceReport(documentId, checks);
      report.processingTime = Date.now() - startTime;

      // Store compliance report
      await this.storeComplianceReport(report);

      this.logger.log(`Compliance check completed for document ${documentId}`);
      return report;

    } catch (error) {
      this.logger.error(`Compliance check failed for document ${documentId}:`, error);
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }

  async batchComplianceCheck(
    documentIds: string[],
    options: ComplianceOptions = {}
  ): Promise<Map<string, ComplianceReport>> {
    const results = new Map<string, ComplianceReport>();

    for (const documentId of documentIds) {
      try {
        const report = await this.checkDocumentCompliance(documentId, options);
        results.set(documentId, report);
      } catch (error) {
        this.logger.error(`Batch compliance check failed for document ${documentId}:`, error);
        // Continue with other documents
      }
    }

    return results;
  }

  async getComplianceRules(
    category?: string,
    enabled?: boolean
  ): Promise<ComplianceRule[]> {
    let rules = [...this.defaultRules];

    if (category) {
      rules = rules.filter(rule => rule.category === category);
    }

    if (enabled !== undefined) {
      rules = rules.filter(rule => rule.enabled === enabled);
    }

    return rules;
  }

  async createComplianceRule(rule: Omit<ComplianceRule, 'id'>): Promise<ComplianceRule> {
    const newRule: ComplianceRule = {
      ...rule,
      id: this.generateRuleId(),
    };

    this.defaultRules.push(newRule);
    return newRule;
  }

  async updateComplianceRule(
    ruleId: string,
    updates: Partial<ComplianceRule>
  ): Promise<ComplianceRule> {
    const ruleIndex = this.defaultRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      throw new Error(`Compliance rule not found: ${ruleId}`);
    }

    this.defaultRules[ruleIndex] = { ...this.defaultRules[ruleIndex], ...updates };
    return this.defaultRules[ruleIndex];
  }

  async deleteComplianceRule(ruleId: string): Promise<void> {
    const ruleIndex = this.defaultRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      throw new Error(`Compliance rule not found: ${ruleId}`);
    }

    this.defaultRules.splice(ruleIndex, 1);
  }

  async getComplianceStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalChecks: number;
    complianceRate: number;
    ruleUsage: Record<string, number>;
    violationTypes: Record<string, number>;
    trends: Array<{
      date: Date;
      compliant: number;
      nonCompliant: number;
    }>;
  }> {
    // This would typically query a compliance reports table
    // For now, return mock statistics
    return {
      totalChecks: 0,
      complianceRate: 0,
      ruleUsage: {},
      violationTypes: {},
      trends: [],
    };
  }

  private initializeDefaultRules(): void {
    // Security Rules
    this.defaultRules.push({
      id: 'sec-001',
      name: 'Malicious Content Detection',
      description: 'Detect potentially malicious content in documents',
      category: 'security',
      severity: 'critical',
      enabled: true,
      conditions: {
        contentPatterns: [
          {
            type: 'regex',
            pattern: '(?i)(eval|exec|system|cmd|powershell|bash|sh)',
            required: true,
          },
          {
            type: 'keyword',
            pattern: 'malware virus trojan backdoor exploit payload',
            required: true,
          },
        ],
      },
      actions: [
        { type: 'block', parameters: { reason: 'malicious_content' } },
        { type: 'notify', parameters: { recipients: ['security-team'] } },
      ],
    });

    this.defaultRules.push({
      id: 'sec-002',
      name: 'PII Detection',
      description: 'Detect personally identifiable information',
      category: 'security',
      severity: 'high',
      enabled: true,
      conditions: {
        contentPatterns: [
          {
            type: 'regex',
            pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', // SSN pattern
            required: false,
          },
          {
            type: 'regex',
            pattern: '\\b\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b', // Credit card pattern
            required: false,
          },
          {
            type: 'entity',
            pattern: 'email phone address social security number credit card',
            required: false,
          },
        ],
      },
      actions: [
        { type: 'encrypt', parameters: { fields: ['extractedText'] } },
        { type: 'require_approval', parameters: { minApproverLevel: 'manager' } },
      ],
    });

    // Privacy Rules
    this.defaultRules.push({
      id: 'priv-001',
      name: 'GDPR Compliance',
      description: 'Ensure GDPR compliance for EU data',
      category: 'privacy',
      severity: 'high',
      enabled: true,
      conditions: {
        categories: [DocumentCategory.ID_DOCUMENT, DocumentCategory.FINANCIAL_STATEMENT],
        metadataRequirements: [
          {
            field: 'retentionPeriod',
            type: 'required',
            condition: 'max_7_years',
          },
          {
            field: 'consent',
            type: 'required',
          },
        ],
      },
      actions: [
        { type: 'flag', parameters: { reason: 'gdpr_violation' } },
        { type: 'notify', parameters: { recipients: ['dpo'] } },
      ],
    });

    // Financial Rules
    this.defaultRules.push({
      id: 'fin-001',
      name: 'AML Screening',
      description: 'Anti-money laundering screening requirements',
      category: 'financial',
      severity: 'critical',
      enabled: true,
      conditions: {
        categories: [DocumentCategory.INVOICE, DocumentCategory.FINANCIAL_STATEMENT],
        contentPatterns: [
          {
            type: 'entity',
            pattern: 'transaction payment wire transfer beneficiary',
            required: false,
          },
          {
            type: 'keyword',
            pattern: 'sanctions ofac terrorist money laundering suspicious',
            required: false,
          },
        ],
      },
      actions: [
        { type: 'block', parameters: { reason: 'aml_suspicion' } },
        { type: 'require_approval', parameters: { minApproverLevel: 'compliance_officer' } },
        { type: 'notify', parameters: { recipients: ['aml-team'] } },
      ],
    });

    // Legal Rules
    this.defaultRules.push({
      id: 'legal-001',
      name: 'Contract Requirements',
      description: 'Ensure contracts have required legal elements',
      category: 'legal',
      severity: 'medium',
      enabled: true,
      conditions: {
        categories: [DocumentCategory.CONTRACT],
        metadataRequirements: [
          {
            field: 'signatures',
            type: 'required',
          },
          {
            field: 'dates',
            type: 'required',
          },
          {
            field: 'terms',
            type: 'required',
          },
        ],
      },
      actions: [
        { type: 'flag', parameters: { reason: 'missing_legal_elements' } },
        { type: 'require_approval', parameters: { minApproverLevel: 'legal' } },
      ],
    });

    // Quality Rules
    this.defaultRules.push({
      id: 'qual-001',
      name: 'Document Quality',
      description: 'Ensure minimum document quality standards',
      category: 'quality',
      severity: 'medium',
      enabled: true,
      conditions: {
        fileSizes: {
          max: 50 * 1024 * 1024, // 50MB
        },
        contentPatterns: [
          {
            type: 'regex',
            pattern: '^\\s*$', // Empty content
            required: true,
          },
        ],
      },
      actions: [
        { type: 'flag', parameters: { reason: 'quality_issues' } },
      ],
    });

    this.defaultRules.push({
      id: 'qual-002',
      name: 'OCR Quality Threshold',
      description: 'Minimum OCR confidence for documents',
      category: 'quality',
      severity: 'low',
      enabled: true,
      conditions: {
        documentTypes: [DocumentType.IMAGE],
        metadataRequirements: [
          {
            field: 'ocrConfidence',
            type: 'required',
            condition: 'min_0.8',
          },
        ],
      },
      actions: [
        { type: 'flag', parameters: { reason: 'low_ocr_quality' } },
      ],
    });
  }

  private getApplicableRules(
    document: Document,
    options: ComplianceOptions
  ): ComplianceRule[] {
    let rules = [...this.defaultRules];

    // Filter by category
    if (options.categories && options.categories.length > 0) {
      rules = rules.filter(rule => options.categories!.includes(rule.category));
    }

    // Filter by severity
    if (options.severity) {
      const severityLevels = ['low', 'medium', 'high', 'critical'];
      const targetLevel = severityLevels.indexOf(options.severity);
      rules = rules.filter(rule => {
        const ruleLevel = severityLevels.indexOf(rule.severity);
        return ruleLevel >= targetLevel;
      });
    }

    // Filter enabled status
    if (!options.includeDisabled) {
      rules = rules.filter(rule => rule.enabled);
    }

    // Add custom rules
    if (options.customRules) {
      rules.push(...options.customRules);
    }

    // Filter by document-specific conditions
    return rules.filter(rule => this.isRuleApplicable(rule, document));
  }

  private isRuleApplicable(rule: ComplianceRule, document: Document): boolean {
    const conditions = rule.conditions;

    // Check document types
    if (conditions.documentTypes && conditions.documentTypes.length > 0) {
      if (!conditions.documentTypes.includes(document.documentType)) {
        return false;
      }
    }

    // Check categories
    if (conditions.categories && conditions.categories.length > 0) {
      if (!conditions.categories.includes(document.category)) {
        return false;
      }
    }

    // Check file sizes
    if (conditions.fileSizes) {
      if (conditions.fileSizes.min && document.fileSize < conditions.fileSizes.min) {
        return false;
      }
      if (conditions.fileSizes.max && document.fileSize > conditions.fileSizes.max) {
        return false;
      }
    }

    return true;
  }

  private async evaluateRule(
    document: Document,
    rule: ComplianceRule
  ): Promise<ComplianceCheckResult> {
    const startTime = Date.now();
    
    try {
      const violations: Array<{
        type: string;
        description: string;
        location?: string;
      }> = [];

      // Check content patterns
      if (rule.conditions.contentPatterns) {
        for (const pattern of rule.conditions.contentPatterns) {
          const violation = await this.checkContentPattern(document, pattern);
          if (violation) {
            violations.push(violation);
          }
        }
      }

      // Check metadata requirements
      if (rule.conditions.metadataRequirements) {
        for (const requirement of rule.conditions.metadataRequirements) {
          const violation = this.checkMetadataRequirement(document, requirement);
          if (violation) {
            violations.push(violation);
          }
        }
      }

      const status = violations.length === 0 ? 'passed' : 
                     violations.some(v => rule.severity === 'critical') ? 'failed' : 'warning';

      const recommendations = this.generateRecommendations(rule, violations);

      return {
        documentId: document.id,
        ruleId: rule.id,
        ruleName: rule.name,
        status,
        severity: rule.severity,
        details: {
          message: this.generateStatusMessage(status, violations),
          violations,
          recommendations,
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error(`Rule evaluation failed for rule ${rule.id}:`, error);
      return {
        documentId: document.id,
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'error',
        severity: rule.severity,
        details: {
          message: `Rule evaluation error: ${error.message}`,
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async checkContentPattern(
    document: Document,
    pattern: { type: 'regex' | 'keyword' | 'entity'; pattern: string; required: boolean }
  ): Promise<{ type: string; description: string; location?: string } | null> {
    const text = document.extractedText || '';
    const metadata = document.extractedMetadata || {};
    const keyInformation = document.keyInformation || {};

    switch (pattern.type) {
      case 'regex':
        try {
          const regex = new RegExp(pattern.pattern, 'gi');
          const matches = text.match(regex);
          
          if (matches && matches.length > 0) {
            return {
              type: 'regex_match',
              description: `Pattern matched: ${pattern.pattern}`,
              location: `Character ${matches.index}`,
            };
          }
        } catch (error) {
          this.logger.error(`Invalid regex pattern: ${pattern.pattern}`, error);
        }
        break;

      case 'keyword':
        const keywords = pattern.pattern.toLowerCase().split(' ');
        const textLower = text.toLowerCase();
        
        for (const keyword of keywords) {
          if (textLower.includes(keyword)) {
            return {
              type: 'keyword_found',
              description: `Keyword found: ${keyword}`,
              location: 'Content contains restricted keyword',
            };
          }
        }
        break;

      case 'entity':
        // Check extracted entities for restricted types
        if (keyInformation.entities && Array.isArray(keyInformation.entities)) {
          const restrictedEntities = pattern.pattern.toLowerCase().split(' ');
          
          for (const entity of keyInformation.entities) {
            if (restrictedEntities.includes(entity.type.toLowerCase())) {
              return {
                type: 'entity_found',
                description: `Restricted entity found: ${entity.type}`,
                location: `Entity: ${entity.text}`,
              };
            }
          }
        }
        break;
    }

    return pattern.required ? null : undefined;
  }

  private checkMetadataRequirement(
    document: Document,
    requirement: { field: string; type: 'required' | 'recommended'; condition?: string }
  ): { type: string; description: string; location?: string } | null {
    const metadata = document.extractedMetadata || {};
    const fieldValue = this.getMetadataFieldValue(metadata, requirement.field);

    switch (requirement.type) {
      case 'required':
        if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
          return {
            type: 'missing_required',
            description: `Required field missing: ${requirement.field}`,
            location: `Metadata field: ${requirement.field}`,
          };
        }
        break;

      case 'recommended':
        if (!fieldValue) {
          return {
            type: 'missing_recommended',
            description: `Recommended field missing: ${requirement.field}`,
            location: `Metadata field: ${requirement.field}`,
          };
        }
        break;
    }

    // Check conditions
    if (requirement.condition && fieldValue) {
      if (requirement.condition === 'max_7_years' && typeof fieldValue === 'string') {
        const date = new Date(fieldValue);
        const sevenYearsAgo = new Date();
        sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
        
        if (date > sevenYearsAgo) {
          return {
            type: 'condition_violation',
            description: `Data retention exceeds 7 years: ${requirement.field}`,
            location: `Metadata field: ${requirement.field}`,
          };
        }
      }

      if (requirement.condition === 'min_0.8' && typeof fieldValue === 'number') {
        if (fieldValue < 0.8) {
          return {
            type: 'condition_violation',
            description: `OCR confidence below threshold: ${requirement.field}`,
            location: `Processing metrics: ${requirement.field}`,
          };
        }
      }
    }

    return null;
  }

  private getMetadataFieldValue(metadata: any, field: string): any {
    const fieldPath = field.split('.');
    let value = metadata;

    for (const path of fieldPath) {
      value = value?.[path];
    }

    return value;
  }

  private generateStatusMessage(
    status: 'passed' | 'failed' | 'warning' | 'error',
    violations: Array<{ type: string; description: string }>
  ): string {
    switch (status) {
      case 'passed':
        return 'All checks passed';
      case 'failed':
        return `Compliance check failed with ${violations.length} violation(s)`;
      case 'warning':
        return `Compliance check completed with ${violations.length} warning(s)`;
      case 'error':
        return 'Compliance check encountered an error';
      default:
        return 'Unknown status';
    }
  }

  private generateRecommendations(
    rule: ComplianceRule,
    violations: Array<{ type: string; description: string }>
  ): string[] {
    const recommendations: string[] = [];

    for (const action of rule.actions) {
      switch (action.type) {
        case 'block':
          recommendations.push(`Document blocked due to: ${rule.name}`);
          break;
        case 'flag':
          recommendations.push(`Review document for: ${rule.name}`);
          break;
        case 'require_approval':
          recommendations.push(`Document requires approval due to: ${rule.name}`);
          break;
        case 'notify':
          recommendations.push(`Notification sent for: ${rule.name}`);
          break;
        case 'encrypt':
          recommendations.push(`Document encryption recommended for: ${rule.name}`);
          break;
      }
    }

    // Add specific recommendations based on violations
    for (const violation of violations) {
      switch (violation.type) {
        case 'missing_required':
          recommendations.push(`Add required field: ${violation.description}`);
          break;
        case 'regex_match':
          recommendations.push(`Remove restricted content: ${violation.description}`);
          break;
        case 'entity_found':
          recommendations.push(`Remove or redact PII: ${violation.description}`);
          break;
        case 'condition_violation':
          recommendations.push(`Fix compliance issue: ${violation.description}`);
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private generateComplianceReport(
    documentId: string,
    checks: ComplianceCheckResult[]
  ): ComplianceReport {
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.status === 'passed').length;
    const failedChecks = checks.filter(c => c.status === 'failed').length;
    const warningChecks = checks.filter(c => c.status === 'warning').length;
    const errorChecks = checks.filter(c => c.status === 'error').length;

    const criticalIssues = checks.filter(c => c.severity === 'critical').length;
    const highIssues = checks.filter(c => c.severity === 'high').length;
    const mediumIssues = checks.filter(c => c.severity === 'medium').length;
    const lowIssues = checks.filter(c => c.severity === 'low').length;

    // Calculate overall compliance score
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    let totalWeight = 0;
    let maxWeight = 0;

    for (const check of checks) {
      if (check.status !== 'passed') {
        totalWeight += severityWeights[check.severity] || 0;
      }
      maxWeight += severityWeights[check.severity] || 0;
    }

    const score = maxWeight > 0 ? Math.max(0, 100 - (totalWeight / maxWeight * 100)) : 100;

    // Determine overall status
    let overallStatus: 'compliant' | 'non_compliant' | 'requires_review';
    if (criticalIssues > 0 || highIssues > 0) {
      overallStatus = 'non_compliant';
    } else if (mediumIssues > 0 || lowIssues > 0) {
      overallStatus = 'requires_review';
    } else {
      overallStatus = 'compliant';
    }

    // Collect all recommendations
    const allRecommendations = new Set<string>();
    for (const check of checks) {
      if (check.details.recommendations) {
        for (const rec of check.details.recommendations) {
          allRecommendations.add(rec);
        }
      }
    }

    return {
      documentId,
      overallStatus,
      score,
      checks,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        warningChecks,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
      },
      recommendations: Array.from(allRecommendations),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    // In a real implementation, this would store in a compliance reports table
    // For now, we'll just log it
    this.logger.log(`Compliance report stored for document ${report.documentId}`, {
      status: report.overallStatus,
      score: report.score,
      issues: report.summary.failedChecks + report.summary.warningChecks,
    });
  }

  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async schedulePeriodicComplianceChecks(): Promise<void> {
    // This would set up a cron job to run compliance checks periodically
    this.logger.log('Periodic compliance checks scheduled');
  }

  async exportComplianceReport(
    documentId: string,
    format: 'pdf' | 'json' | 'csv' = 'pdf'
  ): Promise<{ url: string; fileName: string }> {
    const report = await this.checkDocumentCompliance(documentId);
    
    const fileName = `compliance-report-${documentId}-${format}.${format}`;
    const url = `/exports/compliance/${fileName}`;
    
    // In a real implementation, generate the actual file
    this.logger.log(`Compliance report exported for document ${documentId} as ${format}`);
    
    return { url, fileName };
  }
}
