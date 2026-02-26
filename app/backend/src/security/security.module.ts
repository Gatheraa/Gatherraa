import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { MfaSetting, MfaSession } from './entities/mfa.entity';
import { Permission, Role, UserRole, RoleHierarchy, PermissionPolicy } from './entities/rbac.entity';
import { KycVerification, KycDocument, AmlAlert } from './entities/kyc.entity';
import { SecurityAuditLog } from './services/security-audit.service';
import { SecurityAnomaly } from './services/intrusion-detection.service';
import { ComplianceReport, ComplianceRegulation } from './services/compliance.service';

// Services
import { MfaService } from './services/mfa.service';
import { RbacService } from './services/rbac.service';
import { KycAmlService } from './services/kyc-aml.service';
import { EncryptionService } from './services/encryption.service';
import { SecurityAuditService } from './services/security-audit.service';
import { IntrusionDetectionService } from './services/intrusion-detection.service';
import { ComplianceService } from './services/compliance.service';

// Controllers
import { SecurityController } from './controllers/security.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // MFA Entities
      MfaSetting,
      MfaSession,
      
      // RBAC Entities
      Permission,
      Role,
      UserRole,
      RoleHierarchy,
      PermissionPolicy,
      
      // KYC/AML Entities
      KycVerification,
      KycDocument,
      AmlAlert,
      
      // Security Entities
      SecurityAuditLog,
      SecurityAnomaly,
      
      // Compliance Entities
      ComplianceReport,
      ComplianceRegulation,
    ]),
    ConfigModule,
  ],
  controllers: [SecurityController],
  providers: [
    MfaService,
    RbacService,
    KycAmlService,
    EncryptionService,
    SecurityAuditService,
    IntrusionDetectionService,
    ComplianceService,
  ],
  exports: [
    MfaService,
    RbacService,
    KycAmlService,
    EncryptionService,
    SecurityAuditService,
    IntrusionDetectionService,
    ComplianceService,
  ],
})
export class SecurityModule {}
