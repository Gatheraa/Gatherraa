import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceMonitoringService } from '../services/compliance-monitoring.service';
import { PrivacyFrameworkService } from '../services/privacy-framework.service';

describe('PrivacyCompliance', () => {
  let complianceService: ComplianceMonitoringService;
  let frameworkService: PrivacyFrameworkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceMonitoringService,
        PrivacyFrameworkService,
      ],
    }).compile();

    complianceService = module.get<ComplianceMonitoringService>(ComplianceMonitoringService);
    frameworkService = module.get<PrivacyFrameworkService>(PrivacyFrameworkService);
  });

  describe('GDPR Compliance', () => {
    it('should validate GDPR Article 5 - Principles of processing', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      expect(gdprFramework).toBeDefined();
      const article5Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_5');
      
      expect(article5Requirement).toBeDefined();
      expect(article5Requirement!.title).toBe('Principles of processing personal data');
      expect(article5Requirement!.category).toBe('Data Protection Principles');
      expect(article5Requirement!.mandatory).toBe(true);
      expect(article5Requirement!.riskLevel).toBe('critical');
    });

    it('should validate GDPR Article 7 - Conditions for consent', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article7Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_7');
      
      expect(article7Requirement).toBeDefined();
      expect(article7Requirement!.title).toBe('Conditions for consent');
      expect(article7Requirement!.category).toBe('Consent Management');
      expect(article7Requirement!.mandatory).toBe(true);
      expect(article7Requirement!.riskLevel).toBe('critical');
    });

    it('should validate GDPR Article 15 - Right of access', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article15Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_15');
      
      expect(article15Requirement).toBeDefined();
      expect(article15Requirement!.title).toBe('Right of access');
      expect(article15Requirement!.category).toBe('Data Subject Rights');
      expect(article15Requirement!.mandatory).toBe(true);
      expect(article15Requirement!.riskLevel).toBe('high');
    });

    it('should validate GDPR Article 17 - Right to erasure', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article17Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_17');
      
      expect(article17Requirement).toBeDefined();
      expect(article17Requirement!.title).toBe('Right to erasure');
      expect(article17Requirement!.category).toBe('Data Subject Rights');
      expect(article17Requirement!.mandatory).toBe(true);
      expect(article17Requirement!.riskLevel).toBe('critical');
    });

    it('should validate GDPR Article 32 - Security of processing', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article32Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_32');
      
      expect(article32Requirement).toBeDefined();
      expect(article32Requirement!.title).toBe('Security of processing');
      expect(article32Requirement!.category).toBe('Data Security');
      expect(article32Requirement!.mandatory).toBe(true);
      expect(article32Requirement!.riskLevel).toBe('critical');
    });

    it('should validate GDPR Article 33 - Notification of personal data breach', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article33Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_33');
      
      expect(article33Requirement).toBeDefined();
      expect(article33Requirement!.title).toBe('Notification of personal data breach');
      expect(article33Requirement!.category).toBe('Breach Management');
      expect(article33Requirement!.mandatory).toBe(true);
      expect(article33Requirement!.riskLevel).toBe('critical');
    });

    it('should validate GDPR Article 35 - Data protection impact assessment', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const article35Requirement = gdprFramework!.requirements.find(r => r.id === 'GDPR_ART_35');
      
      expect(article35Requirement).toBeDefined();
      expect(article35Requirement!.title).toBe('Data protection impact assessment');
      expect(article35Requirement!.category).toBe('Risk Assessment');
      expect(article35Requirement!.mandatory).toBe(true);
      expect(article35Requirement!.riskLevel).toBe('high');
    });
  });

  describe('CCPA Compliance', () => {
    it('should validate CCPA Right to Know', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ccpaFramework = frameworks.find(f => f.name === 'CCPA');
      
      expect(ccpaFramework).toBeDefined();
      const rightToKnowRequirement = ccpaFramework!.requirements.find(r => r.id === 'CCPA_1798.100');
      
      expect(rightToKnowRequirement).toBeDefined();
      expect(rightToKnowRequirement!.title).toBe('Right to Know');
      expect(rightToKnowRequirement!.category).toBe('Transparency');
      expect(rightToKnowRequirement!.mandatory).toBe(true);
      expect(rightToKnowRequirement!.riskLevel).toBe('high');
    });

    it('should validate CCPA Right to Delete', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ccpaFramework = frameworks.find(f => f.name === 'CCPA');
      
      const rightToDeleteRequirement = ccpaFramework!.requirements.find(r => r.id === 'CCPA_1798.105');
      
      expect(rightToDeleteRequirement).toBeDefined();
      expect(rightToDeleteRequirement!.title).toBe('Right to Delete');
      expect(rightToDeleteRequirement!.category).toBe('Data Subject Rights');
      expect(rightToDeleteRequirement!.mandatory).toBe(true);
      expect(rightToDeleteRequirement!.riskLevel).toBe('critical');
    });

    it('should validate CCPA Right to Opt-Out', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ccpaFramework = frameworks.find(f => f.name === 'CCPA');
      
      const rightToOptOutRequirement = ccpaFramework!.requirements.find(r => r.id === 'CCPA_1798.120');
      
      expect(rightToOptOutRequirement).toBeDefined();
      expect(rightToOptOutRequirement!.title).toBe('Right to Opt-Out');
      expect(rightToOptOutRequirement!.category).toBe('Data Sharing');
      expect(rightToOptOutRequirement!.mandatory).toBe(true);
      expect(rightToOptOutRequirement!.riskLevel).toBe('high');
    });

    it('should validate CCPA Non-Discrimination', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ccpaFramework = frameworks.find(f => f.name === 'CCPA');
      
      const nonDiscriminationRequirement = ccpaFramework!.requirements.find(r => r.id === 'CCPA_1798.130');
      
      expect(nonDiscriminationRequirement).toBeDefined();
      expect(nonDiscriminationRequirement!.title).toBe('Non-Discrimination');
      expect(nonDiscriminationRequirement!.category).toBe('Fair Treatment');
      expect(nonDiscriminationRequirement!.mandatory).toBe(true);
      expect(nonDiscriminationRequirement!.riskLevel).toBe('medium');
    });
  });

  describe('FERPA Compliance', () => {
    it('should validate FERPA Annual Notification', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ferpaFramework = frameworks.find(f => f.name === 'FERPA');
      
      expect(ferpaFramework).toBeDefined();
      const annualNotificationRequirement = ferpaFramework!.requirements.find(r => r.id === 'FERPA_99.31');
      
      expect(annualNotificationRequirement).toBeDefined();
      expect(annualNotificationRequirement!.title).toBe('Annual Notification');
      expect(annualNotificationRequirement!.category).toBe('Notification');
      expect(annualNotificationRequirement!.mandatory).toBe(true);
      expect(annualNotificationRequirement!.riskLevel).toBe('medium');
    });

    it('should validate FERPA Directory Information', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ferpaFramework = frameworks.find(f => f.name === 'FERPA');
      
      const directoryInfoRequirement = ferpaFramework!.requirements.find(r => r.id === 'FERPA_99.30');
      
      expect(directoryInfoRequirement).toBeDefined();
      expect(directoryInfoRequirement!.title).toBe('Directory Information');
      expect(directoryInfoRequirement!.category).toBe('Directory Information');
      expect(directoryInfoRequirement!.mandatory).toBe(true);
      expect(directoryInfoRequirement!.riskLevel).toBe('medium');
    });

    it('should validate FERPA Record of Access', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ferpaFramework = frameworks.find(f => f.name === 'FERPA');
      
      const recordAccessRequirement = ferpaFramework!.requirements.find(r => r.id === 'FERPA_99.32');
      
      expect(recordAccessRequirement).toBeDefined();
      expect(recordAccessRequirement!.title).toBe('Record of Access');
      expect(recordAccessRequirement!.category).toBe('Access Control');
      expect(recordAccessRequirement!.mandatory).toBe(true);
      expect(recordAccessRequirement!.riskLevel).toBe('high');
    });
  });

  describe('Compliance Monitoring', () => {
    it('should track compliance status across frameworks', () => {
      const status = complianceService.getComplianceStatus();
      
      expect(status).toHaveProperty('overallScore');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('checks');
      expect(status).toHaveProperty('alerts');
      
      expect(typeof status.overallScore).toBe('number');
      expect(status.overallScore).toBeGreaterThanOrEqual(0);
      expect(status.overallScore).toBeLessThanOrEqual(100);
      
      expect(['compliant', 'non_compliant', 'attention_required']).toContain(status.status);
      expect(Array.isArray(status.checks)).toBe(true);
      expect(Array.isArray(status.alerts)).toBe(true);
    });

    it('should have compliance checks for all requirements', () => {
      const status = complianceService.getComplianceStatus();
      const frameworks = frameworkService.getComplianceFrameworks();
      
      // Total requirements across all frameworks
      const totalRequirements = frameworks.reduce((sum, framework) => 
        sum + framework.requirements.length, 0
      );
      
      // Should have checks for all requirements
      expect(status.checks.length).toBe(totalRequirements);
    });

    it('should generate compliance reports for each framework', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      for (const framework of frameworks) {
        const report = await complianceService.generateComplianceReport(
          framework.name, 
          startDate, 
          endDate
        );
        
        expect(report).toHaveProperty('framework', framework.name);
        expect(report).toHaveProperty('period');
        expect(report).toHaveProperty('overallScore');
        expect(report).toHaveProperty('status');
        expect(report).toHaveProperty('checks');
        expect(report).toHaveProperty('trends');
        expect(report).toHaveProperty('recommendations');
        expect(report).toHaveProperty('generatedAt');
        
        expect(typeof report.overallScore).toBe('number');
        expect(['compliant', 'non_compliant', 'attention_required']).toContain(report.status);
      }
    });
  });

  describe('Risk Assessment', () => {
    it('should categorize requirements by risk level', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      
      for (const framework of frameworks) {
        const criticalRequirements = framework.requirements.filter(r => r.riskLevel === 'critical');
        const highRequirements = framework.requirements.filter(r => r.riskLevel === 'high');
        const mediumRequirements = framework.requirements.filter(r => r.riskLevel === 'medium');
        const lowRequirements = framework.requirements.filter(r => r.riskLevel === 'low');
        
        expect(criticalRequirements.length).toBeGreaterThanOrEqual(0);
        expect(highRequirements.length).toBeGreaterThanOrEqual(0);
        expect(mediumRequirements.length).toBeGreaterThanOrEqual(0);
        expect(lowRequirements.length).toBeGreaterThanOrEqual(0);
        
        // GDPR should have critical requirements
        if (framework.name === 'GDPR') {
          expect(criticalRequirements.length).toBeGreaterThan(0);
        }
      }
    });

    it('should identify mandatory requirements', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      
      for (const framework of frameworks) {
        const mandatoryRequirements = framework.requirements.filter(r => r.mandatory);
        const optionalRequirements = framework.requirements.filter(r => !r.mandatory);
        
        expect(mandatoryRequirements.length).toBeGreaterThan(0);
        expect(mandatoryRequirements.length + optionalRequirements.length).toBe(framework.requirements.length);
      }
    });
  });

  describe('Reporting Requirements', () => {
    it('should define reporting requirements for each framework', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      
      for (const framework of frameworks) {
        expect(framework.reportingRequirements).toBeDefined();
        expect(Array.isArray(framework.reportingRequirements)).toBe(true);
        expect(framework.reportingRequirements.length).toBeGreaterThan(0);
        
        for (const requirement of framework.reportingRequirements) {
          expect(requirement).toHaveProperty('type');
          expect(requirement).toHaveProperty('frequency');
          expect(requirement).toHaveProperty('recipients');
          expect(requirement).toHaveProperty('template');
          expect(requirement).toHaveProperty('dataRequired');
          
          expect(Array.isArray(requirement.recipients)).toBe(true);
          expect(Array.isArray(requirement.dataRequired)).toBe(true);
        }
      }
    });

    it('should have GDPR-specific reporting requirements', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const gdprFramework = frameworks.find(f => f.name === 'GDPR');
      
      const gdprReporting = gdprFramework!.reportingRequirements;
      
      // Should have data subject requests reporting
      expect(gdprReporting.some(r => r.type === 'data_subject_requests')).toBe(true);
      
      // Should have breach notification reporting
      expect(gdprReporting.some(r => r.type === 'breach_notifications')).toBe(true);
      
      // Should have compliance audit reporting
      expect(gdprReporting.some(r => r.type === 'compliance_audit')).toBe(true);
    });

    it('should have CCPA-specific reporting requirements', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ccpaFramework = frameworks.find(f => f.name === 'CCPA');
      
      const ccpaReporting = ccpaFramework!.reportingRequirements;
      
      // Should have consumer requests reporting
      expect(ccpaReporting.some(r => r.type === 'consumer_requests')).toBe(true);
      
      // Should have data inventory reporting
      expect(ccpaReporting.some(r => r.type === 'data_inventory')).toBe(true);
    });

    it('should have FERPA-specific reporting requirements', () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const ferpaFramework = frameworks.find(f => f.name === 'FERPA');
      
      const ferpaReporting = ferpaFramework!.reportingRequirements;
      
      // Should have directory opt-out reporting
      expect(ferpaReporting.some(r => r.type === 'directory_opt_outs')).toBe(true);
      
      // Should have record access reporting
      expect(ferpaReporting.some(r => r.type === 'record_access')).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    it('should maintain audit trail for compliance checks', () => {
      const status = complianceService.getComplianceStatus();
      
      for (const check of status.checks) {
        expect(check).toHaveProperty('id');
        expect(check).toHaveProperty('framework');
        expect(check).toHaveProperty('requirement');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('score');
        expect(check).toHaveProperty('lastChecked');
        expect(check).toHaveProperty('nextReview');
        expect(check).toHaveProperty('evidence');
        expect(check).toHaveProperty('findings');
        expect(check).toHaveProperty('recommendations');
        
        expect(['compliant', 'non_compliant', 'partial', 'not_assessed']).toContain(check.status);
        expect(typeof check.score).toBe('number');
        expect(check.score).toBeGreaterThanOrEqual(0);
        expect(check.score).toBeLessThanOrEqual(100);
        expect(check.lastChecked).toBeInstanceOf(Date);
        expect(check.nextReview).toBeInstanceOf(Date);
        expect(Array.isArray(check.evidence)).toBe(true);
        expect(Array.isArray(check.recommendations)).toBe(true);
      }
    });
  });

  describe('Integration with Privacy Services', () => {
    it('should integrate with privacy framework metrics', async () => {
      const metrics = await frameworkService.getPrivacyMetrics();
      const status = complianceService.getComplianceStatus();
      
      // Both should provide compliance-related metrics
      expect(metrics).toHaveProperty('complianceScore');
      expect(status).toHaveProperty('overallScore');
      
      // Scores should be in valid range
      expect(metrics.complianceScore).toBeGreaterThanOrEqual(0);
      expect(metrics.complianceScore).toBeLessThanOrEqual(100);
      expect(status.overallScore).toBeGreaterThanOrEqual(0);
      expect(status.overallScore).toBeLessThanOrEqual(100);
    });

    it('should provide comprehensive compliance overview', async () => {
      const frameworks = frameworkService.getComplianceFrameworks();
      const status = complianceService.getComplianceStatus();
      const metrics = await frameworkService.getPrivacyMetrics();
      
      // Should cover all frameworks
      const frameworkNames = frameworks.map(f => f.name);
      const checkFrameworks = [...new Set(status.checks.map(c => c.framework))];
      
      expect(checkFrameworks.sort()).toEqual(frameworkNames.sort());
      
      // Should provide actionable insights
      expect(status.alerts.length).toBeGreaterThanOrEqual(0);
      expect(metrics.breachIncidents).toBeGreaterThanOrEqual(0);
      expect(metrics.auditFindings).toBeGreaterThanOrEqual(0);
    });
  });
});
