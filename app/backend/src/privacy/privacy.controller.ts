import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrivacyFrameworkService } from './services/privacy-framework.service';
import { DataAnonymizationService } from './services/data-anonymization.service';
import { ConsentManagementService, ConsentRequest, DataSubjectRequest } from './services/consent-management.service';
import { BreachDetectionService } from './services/breach-detection.service';
import { ComplianceMonitoringService } from './services/compliance-monitoring.service';
import { PrivacyImpactAssessmentService, DPIARequest } from './services/privacy-impact-assessment.service';
import { CrossBorderTransferService, TransferRequest } from './services/cross-border-transfer.service';
import { PrivacyEnhancingTechnologiesService } from './services/privacy-enhancing-technologies.service';

@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly privacyFrameworkService: PrivacyFrameworkService,
    private readonly dataAnonymizationService: DataAnonymizationService,
    private readonly consentManagementService: ConsentManagementService,
    private readonly breachDetectionService: BreachDetectionService,
    private readonly complianceMonitoringService: ComplianceMonitoringService,
    private readonly privacyImpactAssessmentService: PrivacyImpactAssessmentService,
    private readonly crossBorderTransferService: CrossBorderTransferService,
    private readonly privacyEnhancingTechnologiesService: PrivacyEnhancingTechnologiesService,
  ) {}

  @Get('frameworks')
  @ApiOperation({ summary: 'Get available compliance frameworks' })
  @ApiResponse({ status: 200, description: 'Compliance frameworks retrieved successfully' })
  getComplianceFrameworks() {
    return this.privacyFrameworkService.getComplianceFrameworks();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get privacy metrics' })
  @ApiResponse({ status: 200, description: 'Privacy metrics retrieved successfully' })
  async getPrivacyMetrics() {
    return this.privacyFrameworkService.getPrivacyMetrics();
  }

  @Get('compliance/:framework')
  @ApiOperation({ summary: 'Generate compliance report for framework' })
  @ApiResponse({ status: 200, description: 'Compliance report generated successfully' })
  async generateComplianceReport(@Param('framework') framework: string) {
    return this.privacyFrameworkService.generateComplianceReport(framework);
  }

  @Post('consent')
  @ApiOperation({ summary: 'Create or update consent' })
  @ApiResponse({ status: 201, description: 'Consent created successfully' })
  async createConsent(@Body() consentRequest: ConsentRequest) {
    return this.consentManagementService.createConsent(consentRequest);
  }

  @Put('consent/:userId/:policyId/withdraw')
  @ApiOperation({ summary: 'Withdraw consent' })
  @ApiResponse({ status: 200, description: 'Consent withdrawn successfully' })
  async withdrawConsent(
    @Param('userId') userId: string,
    @Param('policyId') policyId: string,
    @Body('reason') reason?: string,
  ) {
    return this.consentManagementService.withdrawConsent(userId, policyId, reason);
  }

  @Get('consent/:userId')
  @ApiOperation({ summary: 'Get user consents' })
  @ApiResponse({ status: 200, description: 'User consents retrieved successfully' })
  async getUserConsents(@Param('userId') userId: string) {
    return this.consentManagementService.getUserConsents(userId);
  }

  @Get('consent/:userId/check/:category')
  @ApiOperation({ summary: 'Check if user has consent for category' })
  @ApiResponse({ status: 200, description: 'Consent check completed successfully' })
  async hasConsent(
    @Param('userId') userId: string,
    @Param('category') category: string,
  ) {
    return this.consentManagementService.hasConsent(userId, category as any);
  }

  @Post('data-subject-request')
  @ApiOperation({ summary: 'Handle data subject rights request' })
  @ApiResponse({ status: 200, description: 'Data subject request processed successfully' })
  async handleDataSubjectRequest(@Body() request: DataSubjectRequest) {
    return this.consentManagementService.handleDataSubjectRequest(request);
  }

  @Get('consent-metrics')
  @ApiOperation({ summary: 'Get consent metrics' })
  @ApiResponse({ status: 200, description: 'Consent metrics retrieved successfully' })
  async getConsentMetrics(@Query('days') days?: number) {
    return this.consentManagementService.getConsentMetrics(days || 30);
  }

  @Post('anonymize')
  @ApiOperation({ summary: 'Anonymize data' })
  @ApiResponse({ status: 200, description: 'Data anonymized successfully' })
  anonymizeData(@Body() data: any) {
    const fieldConfig = this.dataAnonymizationService.getAnonymizationRecommendation(data);
    return this.dataAnonymizationService.anonymizeObject(data, fieldConfig);
  }

  @Post('pseudonymize')
  @ApiOperation({ summary: 'Pseudonymize data' })
  @ApiResponse({ status: 200, description: 'Data pseudonymized successfully' })
  pseudonymizeData(@Body() data: any) {
    const fields = Object.keys(data);
    return this.dataAnonymizationService.pseudonymize(data, fields);
  }

  @Post('depseudonymize')
  @ApiOperation({ summary: 'De-pseudonymize data' })
  @ApiResponse({ status: 200, description: 'Data de-pseudonymized successfully' })
  depseudonymizeData(@Body() data: any) {
    return this.dataAnonymizationService.depseudonymize(data);
  }

  @Get('breach-statistics')
  @ApiOperation({ summary: 'Get breach statistics' })
  @ApiResponse({ status: 200, description: 'Breach statistics retrieved successfully' })
  async getBreachStatistics(@Query('days') days?: number) {
    return this.breachDetectionService.getBreachStatistics(days || 30);
  }

  @Get('breach-alerts')
  @ApiOperation({ summary: 'Get active breach alerts' })
  @ApiResponse({ status: 200, description: 'Active breach alerts retrieved successfully' })
  getActiveBreachAlerts() {
    return this.breachDetectionService.getActiveAlerts();
  }

  @Delete('breach-alerts/:type')
  @ApiOperation({ summary: 'Clear breach alert' })
  @ApiResponse({ status: 200, description: 'Breach alert cleared successfully' })
  clearBreachAlert(@Param('type') type: string) {
    return this.breachDetectionService.clearAlert(type);
  }

  @Post('security-event')
  @ApiOperation({ summary: 'Report security event' })
  @ApiResponse({ status: 201, description: 'Security event reported successfully' })
  @HttpCode(HttpStatus.CREATED)
  async reportSecurityEvent(@Body() event: any) {
    return this.breachDetectionService.reportSecurityEvent(event);
  }

  @Get('compliance-status')
  @ApiOperation({ summary: 'Get overall compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance status retrieved successfully' })
  getComplianceStatus() {
    return this.complianceMonitoringService.getComplianceStatus();
  }

  @Get('compliance-report/:framework')
  @ApiOperation({ summary: 'Generate comprehensive compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated successfully' })
  async generateComplianceReport(
    @Param('framework') framework: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.complianceMonitoringService.generateComplianceReport(framework, start, end);
  }

  @Get('breach-report')
  @ApiOperation({ summary: 'Generate breach detection report' })
  @ApiResponse({ status: 200, description: 'Breach report generated successfully' })
  async generateBreachReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.breachDetectionService.generateBreachReport(start, end);
  }

  @Get('consent-report')
  @ApiOperation({ summary: 'Generate consent report' })
  @ApiResponse({ status: 200, description: 'Consent report generated successfully' })
  async generateConsentReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.consentManagementService.generateConsentReport(start, end);
  }

  // DPIA Endpoints
  @Post('dpia')
  @ApiOperation({ summary: 'Create DPIA' })
  @ApiResponse({ status: 201, description: 'DPIA created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createDPIA(@Body() dpiaRequest: DPIARequest) {
    return this.privacyImpactAssessmentService.createDPIA(dpiaRequest);
  }

  @Get('dpia/:id')
  @ApiOperation({ summary: 'Get DPIA by ID' })
  @ApiResponse({ status: 200, description: 'DPIA retrieved successfully' })
  async getDPIA(@Param('id') id: string) {
    return this.privacyImpactAssessmentService.getDPIA(id);
  }

  @Put('dpia/:id/status')
  @ApiOperation({ summary: 'Update DPIA status' })
  @ApiResponse({ status: 200, description: 'DPIA status updated successfully' })
  async updateDPIAStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reviewedBy') reviewedBy?: string,
    @Body('approvedBy') approvedBy?: string,
  ) {
    return this.privacyImpactAssessmentService.updateDPIAStatus(id, status as any, reviewedBy, approvedBy);
  }

  @Get('dpia')
  @ApiOperation({ summary: 'Get all DPIAs' })
  @ApiResponse({ status: 200, description: 'All DPIAs retrieved successfully' })
  getAllDPIAs() {
    return this.privacyImpactAssessmentService.getAllDPIAs();
  }

  @Get('dpia-statistics')
  @ApiOperation({ summary: 'Get DPIA statistics' })
  @ApiResponse({ status: 200, description: 'DPIA statistics retrieved successfully' })
  getDPIAStatistics() {
    return this.privacyImpactAssessmentService.getDPIAStatistics();
  }

  // Cross-Border Transfer Endpoints
  @Post('transfer-request')
  @ApiOperation({ summary: 'Create cross-border transfer request' })
  @ApiResponse({ status: 201, description: 'Transfer request created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createTransferRequest(@Body() transferRequest: TransferRequest) {
    return this.crossBorderTransferService.createTransferRequest(transferRequest);
  }

  @Get('transfer/:id')
  @ApiOperation({ summary: 'Get transfer record by ID' })
  @ApiResponse({ status: 200, description: 'Transfer record retrieved successfully' })
  async getTransferRecord(@Param('id') id: string) {
    return this.crossBorderTransferService.getTransferRecord(id);
  }

  @Put('transfer/:id/approve')
  @ApiOperation({ summary: 'Approve transfer request' })
  @ApiResponse({ status: 200, description: 'Transfer request approved successfully' })
  async approveTransferRequest(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy: string,
  ) {
    return this.crossBorderTransferService.approveTransferRequest(id, approvedBy);
  }

  @Get('transfer')
  @ApiOperation({ summary: 'Get all transfer records' })
  @ApiResponse({ status: 200, description: 'All transfer records retrieved successfully' })
  getAllTransferRecords() {
    return this.crossBorderTransferService.getAllTransferRecords();
  }

  @Get('transfer-statistics')
  @ApiOperation({ summary: 'Get transfer statistics' })
  @ApiResponse({ status: 200, description: 'Transfer statistics retrieved successfully' })
  getTransferStatistics() {
    return this.crossBorderTransferService.getTransferStatistics();
  }

  @Get('adequacy-decisions')
  @ApiOperation({ summary: 'Get adequacy decisions' })
  @ApiResponse({ status: 200, description: 'Adequacy decisions retrieved successfully' })
  getAdequacyDecisions() {
    return this.crossBorderTransferService.getAdequacyDecisions();
  }

  @Get('transfer-mechanisms')
  @ApiOperation({ summary: 'Get transfer mechanisms' })
  @ApiResponse({ status: 200, description: 'Transfer mechanisms retrieved successfully' })
  getTransferMechanisms() {
    return this.crossBorderTransferService.getTransferMechanisms();
  }

  // Privacy-Enhancing Technologies Endpoints
  @Get('pet-configurations')
  @ApiOperation({ summary: 'Get all PET configurations' })
  @ApiResponse({ status: 200, description: 'PET configurations retrieved successfully' })
  getAllPETConfigurations() {
    return this.privacyEnhancingTechnologiesService.getAllPETConfigurations();
  }

  @Get('pet-configurations/:technology')
  @ApiOperation({ summary: 'Get PET configuration by technology' })
  @ApiResponse({ status: 200, description: 'PET configuration retrieved successfully' })
  getPETConfiguration(@Param('technology') technology: string) {
    return this.privacyEnhancingTechnologiesService.getPETConfiguration(technology);
  }

  @Put('pet-configurations/:technology')
  @ApiOperation({ summary: 'Update PET configuration' })
  @ApiResponse({ status: 200, description: 'PET configuration updated successfully' })
  updatePETConfiguration(
    @Param('technology') technology: string,
    @Body() config: any,
  ) {
    return this.privacyEnhancingTechnologiesService.updatePETConfiguration(technology, config);
  }

  @Post('pet/homomorphic-encryption')
  @ApiOperation({ summary: 'Apply homomorphic encryption' })
  @ApiResponse({ status: 200, description: 'Homomorphic encryption applied successfully' })
  async applyHomomorphicEncryption(@Body() data: { data: number[], config?: any }) {
    return this.privacyEnhancingTechnologiesService.applyHomomorphicEncryption(data.data, data.config);
  }

  @Post('pet/secure-multi-party-computation')
  @ApiOperation({ summary: 'Perform secure multi-party computation' })
  @ApiResponse({ status: 200, description: 'SMPC performed successfully' })
  async performSecureMultiPartyComputation(@Body() data: { inputs: any[], computation: string, config?: any }) {
    return this.privacyEnhancingTechnologiesService.performSecureMultiPartyComputation(data.inputs, data.computation, data.config);
  }

  @Post('pet/zero-knowledge-proof')
  @ApiOperation({ summary: 'Generate zero-knowledge proof' })
  @ApiResponse({ status: 200, description: 'ZKP generated successfully' })
  async generateZeroKnowledgeProof(@Body() data: { statement: string, witness: any, config?: any }) {
    return this.privacyEnhancingTechnologiesService.generateZeroKnowledgeProof(data.statement, data.witness, data.config);
  }

  @Post('pet/differential-privacy')
  @ApiOperation({ summary: 'Apply differential privacy' })
  @ApiResponse({ status: 200, description: 'Differential privacy applied successfully' })
  async applyDifferentialPrivacy(@Body() data: { data: number[], query: string, config?: any }) {
    return this.privacyEnhancingTechnologiesService.applyDifferentialPrivacy(data.data, data.query, data.config);
  }

  @Post('pet/federated-learning')
  @ApiOperation({ summary: 'Perform federated learning' })
  @ApiResponse({ status: 200, description: 'Federated learning performed successfully' })
  async performFederatedLearning(@Body() data: { clientUpdates: any[], globalModel: any, config?: any }) {
    return this.privacyEnhancingTechnologiesService.performFederatedLearning(data.clientUpdates, data.globalModel, data.config);
  }

  @Post('pet/private-set-intersection')
  @ApiOperation({ summary: 'Perform private set intersection' })
  @ApiResponse({ status: 200, description: 'PSI performed successfully' })
  async performPrivateSetIntersection(@Body() data: { setA: string[], setB: string[], config?: any }) {
    return this.privacyEnhancingTechnologiesService.performPrivateSetIntersection(data.setA, data.setB, data.config);
  }

  @Get('pet-compliance-report')
  @ApiOperation({ summary: 'Get PET compliance report' })
  @ApiResponse({ status: 200, description: 'PET compliance report retrieved successfully' })
  getPETComplianceReport() {
    return this.privacyEnhancingTechnologiesService.getPETComplianceReport();
  }
}
