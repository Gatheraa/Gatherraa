# Security and Compliance Framework

This directory contains the comprehensive security and compliance framework for the Gatherraa financial application. The framework implements enterprise-grade security features designed to protect sensitive financial data and ensure regulatory compliance.

## Architecture Overview

The security framework is organized into several key components:

### Core Services

1. **Multi-Factor Authentication (MFA)** - `services/mfa.service.ts`
   - TOTP, SMS, Email, and Hardware Token support
   - Setup, verification, and challenge workflows
   - Backup codes and recovery options

2. **Role-Based Access Control (RBAC)** - `services/rbac.service.ts`
   - Dynamic permissions and roles
   - Role hierarchy and inheritance
   - Permission policies with conditions
   - Fine-grained access control

3. **KYC/AML Services** - `services/kyc-aml.service.ts`
   - Customer verification workflows
   - Document processing and validation
   - AML risk assessment and screening
   - Alert management and investigation

4. **Encryption Service** - `services/encryption.service.ts`
   - Data encryption at rest and in transit
   - Key rotation and management
   - Password hashing and verification
   - Digital signatures and verification

5. **Security Audit Service** - `services/security-audit.service.ts`
   - Comprehensive audit logging
   - Security event tracking
   - Compliance reporting
   - Investigation and resolution workflows

6. **Intrusion Detection Service** - `services/intrusion-detection.service.ts`
   - Anomaly detection and monitoring
   - Behavioral analysis
   - Automated threat response
   - Security incident management

7. **Compliance Service** - `services/compliance.service.ts`
   - Multi-framework compliance (GDPR, SOX, PCI-DSS, AML, KYC)
   - Automated report generation
   - Compliance scoring and metrics
   - Regulatory filing support

### Data Models

All security entities are defined in the `entities/` directory:

- `mfa.entity.ts` - MFA settings and sessions
- `rbac.entity.ts` - Permissions, roles, and policies
- `kyc.entity.ts` - KYC verifications and AML alerts
- Additional entities for audit logs, anomalies, and compliance reports

### API Layer

The `controllers/security.controller.ts` provides RESTful endpoints for all security operations, with proper authentication and authorization guards.

## Key Features

### Authentication & Authorization
- SIWE (Sign-In with Ethereum) integration
- Multi-factor authentication with multiple methods
- Dynamic role-based access control
- Session management and token refresh

### Data Protection
- AES-256-GCM encryption for sensitive data
- End-to-end encryption for data in transit
- Secure password hashing with scrypt
- Key rotation and management

### Monitoring & Detection
- Real-time security event logging
- Behavioral anomaly detection
- Automated threat response
- Security metrics and dashboards

### Compliance
- Support for multiple regulatory frameworks
- Automated compliance reporting
- Risk assessment and scoring
- Audit trail and evidence collection

## Security Best Practices Implemented

1. **Defense in Depth** - Multiple layers of security controls
2. **Principle of Least Privilege** - Minimal access permissions
3. **Zero Trust Architecture** - Verify everything, trust nothing
4. **Encryption by Default** - All sensitive data encrypted
5. **Comprehensive Auditing** - All security events logged
6. **Automated Monitoring** - Real-time threat detection
7. **Regular Compliance Checks** - Continuous compliance validation

## Configuration

The security framework uses environment variables for configuration:

```bash
# Encryption Keys
ENCRYPTION_PRIMARY_KEY=your-primary-encryption-key
ENCRYPTION_SALT=your-encryption-salt
ENCRYPTION_BACKUP_KEY=your-backup-encryption-key
ENCRYPTION_BACKUP_SALT=your-backup-salt

# Transit Encryption
TRANSIT_KEY=your-transit-key
TRANSIT_SALT=your-transit-salt

# SIWE Configuration
SIWE_DOMAIN=your-domain
SIWE_URI=your-uri
```

## Usage Examples

### MFA Setup
```typescript
// Setup TOTP MFA
await mfaService.setupMfa(userId, MfaMethod.TOTP, {
  secret: 'totp-secret',
  qrCode: 'data:image/png;base64,...'
});

// Verify and enable MFA
await mfaService.verifyAndEnableMfa(userId, MfaMethod.TOTP, '123456');
```

### RBAC Operations
```typescript
// Create role with permissions
await rbacService.createRole('Financial Analyst', 'Can view financial reports', permissionIds);

// Check user permission
const hasPermission = await rbacService.checkPermission(userId, 'read', 'financial_reports');
```

### KYC Verification
```typescript
// Submit KYC verification
await kycAmlService.submitKycVerification(userId, {
  personalInfo: { ... },
  businessInfo: { ... },
  documents: [ ... ]
});

// Review and approve
await kycAmlService.reviewKycVerification(verificationId, reviewerId, 'approved', 'All documents verified');
```

### Compliance Reporting
```typescript
// Generate AML compliance report
const report = await complianceService.generateComplianceReport({
  framework: ComplianceFramework.AML,
  reportType: ReportType.TRANSACTION_MONITORING,
  period: { start: startDate, end: endDate },
  generatedBy: userId
});
```

## Integration

The security framework integrates with:

- **Authentication Module** - Extends existing auth with MFA
- **Users Module** - Enhances user management with RBAC
- **Email/SMS Services** - For MFA codes and notifications
- **Database** - TypeORM entities for all security data
- **Logging** - Structured logging for security events

## Monitoring and Alerting

The framework provides comprehensive monitoring:

- Security event dashboards
- Real-time anomaly alerts
- Compliance score tracking
- Incident response workflows
- Automated report generation

## Testing

All security services include comprehensive test coverage:

- Unit tests for all service methods
- Integration tests for database operations
- Security tests for encryption and authentication
- Compliance tests for regulatory requirements

## Documentation

- API documentation available via Swagger/OpenAPI
- Entity relationships documented in TypeORM
- Security policies and procedures
- Compliance framework mappings

## Security Considerations

1. **Key Management** - Encryption keys are rotated regularly
2. **Audit Trail** - All security actions are logged
3. **Access Control** - Strict RBAC enforcement
4. **Data Protection** - Encryption at rest and in transit
5. **Compliance** - Regular compliance assessments
6. **Monitoring** - 24/7 security monitoring
7. **Incident Response** - Automated threat response

## Future Enhancements

- Biometric authentication support
- Advanced behavioral analytics
- Machine learning-based threat detection
- Additional regulatory frameworks
- Enhanced reporting capabilities
- Integration with external security tools

## Support

For security issues or questions, contact the security team through the established incident response channels.
