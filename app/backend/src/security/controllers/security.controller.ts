import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MfaService, MfaMethod } from '../services/mfa.service';
import { RbacService } from '../services/rbac.service';
import { KycAmlService } from '../services/kyc-aml.service';
import { SecurityAuditService } from '../services/security-audit.service';
import { IntrusionDetectionService } from '../services/intrusion-detection.service';
import { ComplianceService, ComplianceFramework, ReportType } from '../services/compliance.service';

@ApiTags('Security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly rbacService: RbacService,
    private readonly kycAmlService: KycAmlService,
    private readonly auditService: SecurityAuditService,
    private readonly intrusionService: IntrusionDetectionService,
    private readonly complianceService: ComplianceService,
  ) {}

  // MFA Endpoints
  @Post('mfa/setup')
  @ApiOperation({ summary: 'Setup MFA for user' })
  async setupMfa(@Body() body: { method: MfaMethod; userId: string; metadata?: any }) {
    return this.mfaService.setupMfa(body.userId, body.method, body.metadata);
  }

  @Post('mfa/verify')
  @ApiOperation({ summary: 'Verify and enable MFA' })
  async verifyMfa(@Body() body: { userId: string; method: MfaMethod; code: string }) {
    return this.mfaService.verifyAndEnableMfa(body.userId, body.method, body.code);
  }

  @Post('mfa/challenge')
  @ApiOperation({ summary: 'Create MFA challenge' })
  async createChallenge(@Body() body: { userId: string; method?: MfaMethod }) {
    return this.mfaService.createMfaChallenge(body.userId, body.method);
  }

  @Post('mfa/verify-challenge')
  @ApiOperation({ summary: 'Verify MFA challenge' })
  async verifyChallenge(@Body() body: { challengeId: string; code: string }) {
    return this.mfaService.verifyMfaChallenge(body.challengeId, body.code);
  }

  // RBAC Endpoints
  @Post('roles')
  @ApiOperation({ summary: 'Create new role' })
  async createRole(@Body() body: { name: string; description: string; permissionIds: string[] }) {
    return this.rbacService.createRole(body.name, body.description, body.permissionIds);
  }

  @Post('roles/assign')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(@Body() body: { userId: string; roleId: string; context?: any }) {
    return this.rbacService.assignRoleToUser(body);
  }

  @Post('permissions/check')
  @ApiOperation({ summary: 'Check user permission' })
  async checkPermission(@Body() body: { userId: string; action: string; resource: string }) {
    return this.rbacService.checkPermission(body.userId, body.action as any, body.resource as any);
  }

  // KYC/AML Endpoints
  @Post('kyc/submit')
  @ApiOperation({ summary: 'Submit KYC verification' })
  async submitKyc(@Body() body: { userId: string; data: any }) {
    return this.kycAmlService.submitKycVerification(body.userId, body.data);
  }

  @Get('kyc/pending')
  @ApiOperation({ summary: 'Get pending KYC verifications' })
  async getPendingKyc() {
    return this.kycAmlService.getPendingVerifications();
  }

  @Post('kyc/review')
  @ApiOperation({ summary: 'Review KYC verification' })
  async reviewKyc(@Body() body: { verificationId: string; decision: string; notes?: string }) {
    return this.kycAmlService.reviewKycVerification(body.verificationId, 'reviewer', body.decision as any, body.notes);
  }

  @Get('aml/alerts')
  @ApiOperation({ summary: 'Get AML alerts' })
  async getAmlAlerts(@Query('riskLevel') riskLevel?: string) {
    return this.kycAmlService.getAmlAlerts(riskLevel as any);
  }

  // Security Audit Endpoints
  @Get('audit/logs')
  @ApiOperation({ summary: 'Get security audit logs' })
  async getAuditLogs(@Query() query: any) {
    return this.auditService.queryAuditLogs(query);
  }

  @Get('audit/metrics')
  @ApiOperation({ summary: 'Get security metrics' })
  async getSecurityMetrics(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.auditService.getSecurityMetrics(new Date(startDate), new Date(endDate));
  }

  // Intrusion Detection Endpoints
  @Get('intrusion/anomalies')
  @ApiOperation({ summary: 'Get security anomalies' })
  async getAnomalies(@Query('threatLevel') threatLevel?: string) {
    return this.intrusionService.getActiveAnomalies(threatLevel as any);
  }

  @Post('intrusion/investigate')
  @ApiOperation({ summary: 'Investigate security anomaly' })
  async investigateAnomaly(@Body() body: { anomalyId: string; notes?: string }) {
    return this.intrusionService.investigateAnomaly(body.anomalyId, 'investigator', body.notes);
  }

  @Post('intrusion/resolve')
  @ApiOperation({ summary: 'Resolve security anomaly' })
  async resolveAnomaly(@Body() body: { anomalyId: string; resolution: string; notes?: string }) {
    return this.intrusionService.resolveAnomaly(body.anomalyId, 'resolver', body.resolution as any, body.notes);
  }

  // Compliance Endpoints
  @Post('compliance/reports')
  @ApiOperation({ summary: 'Generate compliance report' })
  async generateReport(@Body() body: { framework: ComplianceFramework; reportType: ReportType; period: any }) {
    return this.complianceService.generateComplianceReport(body);
  }

  @Get('compliance/reports')
  @ApiOperation({ summary: 'Get compliance reports' })
  async getReports(@Query() query: any) {
    return this.complianceService.getComplianceReports(query.framework, query.reportType, query.status);
  }

  @Get('compliance/dashboard')
  @ApiOperation({ summary: 'Get compliance dashboard' })
  async getComplianceDashboard() {
    return this.complianceService.getComplianceDashboard();
  }

  @Post('compliance/export/:id')
  @ApiOperation({ summary: 'Export compliance report' })
  async exportReport(@Param('id') id: string, @Query('format') format: string = 'pdf') {
    return this.complianceService.exportReport(id, format as any);
  }
}
