import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { MfaSetting, MfaSession, MfaMethod, MfaStatus } from '../entities/mfa.entity';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { SecurityAuditService } from './security-audit.service';

export interface MfaSetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaChallengeResult {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
  sentTo?: string;
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(MfaSetting)
    private readonly mfaSettingRepository: Repository<MfaSetting>,
    @InjectRepository(MfaSession)
    private readonly mfaSessionRepository: Repository<MfaSession>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: SecurityAuditService,
  ) {}

  async setupMfa(userId: string, method: MfaMethod, metadata?: any): Promise<MfaSetupResult> {
    const user = await this.validateUser(userId);
    
    // Check if MFA method already exists
    const existingMfa = await this.mfaSettingRepository.findOne({
      where: { userId, method },
    });

    if (existingMfa && existingMfa.status === MfaStatus.ACTIVE) {
      throw new BadRequestException(`MFA method ${method} is already enabled`);
    }

    let secret: string;
    let backupCodes: string[] = [];
    let qrCode: string;
    let manualEntryKey: string;

    switch (method) {
      case MfaMethod.TOTP:
        secret = speakeasy.generateSecret({
          name: `Gatherraa (${user.email})`,
          issuer: 'Gatherraa',
          length: 32,
        }).base32;

        qrCode = await qrcode.toDataURL(
          speakeasy.otpauthURL({
            secret,
            label: `Gatherraa (${user.email})`,
            issuer: 'Gatherraa',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          })
        );

        manualEntryKey = secret;
        backupCodes = this.generateBackupCodes();
        break;

      case MfaMethod.SMS:
        if (!metadata?.phoneNumber) {
          throw new BadRequestException('Phone number is required for SMS MFA');
        }
        secret = randomBytes(16).toString('hex');
        backupCodes = this.generateBackupCodes();
        break;

      case MfaMethod.EMAIL:
        if (!metadata?.email) {
          throw new BadRequestException('Email is required for email MFA');
        }
        secret = randomBytes(16).toString('hex');
        backupCodes = this.generateBackupCodes();
        break;

      default:
        throw new BadRequestException(`MFA method ${method} is not supported`);
    }

    // Save MFA setting
    const mfaSetting = this.mfaSettingRepository.create({
      userId,
      method,
      secret,
      backupCodes,
      status: MfaStatus.PENDING,
      metadata: {
        ...metadata,
        issuer: 'Gatherraa',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      },
    });

    await this.mfaSettingRepository.save(mfaSetting);

    // Log audit event
    await this.auditService.logEvent({
      userId,
      action: 'MFA_SETUP_INITIATED',
      resource: 'mfa_setting',
      details: { method, metadata },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      secret,
      qrCode,
      backupCodes,
      manualEntryKey,
    };
  }

  async verifyAndEnableMfa(
    userId: string,
    method: MfaMethod,
    code: string,
    metadata?: any
  ): Promise<boolean> {
    const mfaSetting = await this.mfaSettingRepository.findOne({
      where: { userId, method, status: MfaStatus.PENDING },
    });

    if (!mfaSetting) {
      throw new NotFoundException('MFA setup not found or already completed');
    }

    const isValid = await this.verifyCode(method, mfaSetting.secret, code, mfaSetting.backupCodes);

    if (!isValid) {
      await this.auditService.logEvent({
        userId,
        action: 'MFA_SETUP_FAILED',
        resource: 'mfa_setting',
        details: { method, reason: 'invalid_code' },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    // Activate MFA
    mfaSetting.status = MfaStatus.ACTIVE;
    mfaSetting.isPrimary = !(await this.hasActiveMfa(userId));
    await this.mfaSettingRepository.save(mfaSetting);

    // Log audit event
    await this.auditService.logEvent({
      userId,
      action: 'MFA_SETUP_COMPLETED',
      resource: 'mfa_setting',
      details: { method },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return true;
  }

  async createMfaChallenge(
    userId: string,
    method?: MfaMethod,
    metadata?: any
  ): Promise<MfaChallengeResult> {
    const user = await this.validateUser(userId);
    
    // Get available MFA methods
    const mfaSettings = await this.mfaSettingRepository.find({
      where: { userId, status: MfaStatus.ACTIVE },
    });

    if (mfaSettings.length === 0) {
      throw new BadRequestException('No MFA methods enabled for this user');
    }

    // Use specified method or primary method
    let selectedMethod = method;
    if (!selectedMethod) {
      const primaryMfa = mfaSettings.find(m => m.isPrimary);
      selectedMethod = primaryMfa?.method || mfaSettings[0].method;
    }

    const mfaSetting = mfaSettings.find(m => m.method === selectedMethod);
    if (!mfaSetting) {
      throw new BadRequestException(`MFA method ${selectedMethod} is not enabled`);
    }

    // Generate challenge
    const sessionId = randomBytes(32).toString('hex');
    const challengeToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const mfaSession = this.mfaSessionRepository.create({
      userId,
      sessionId,
      challengeToken,
      method: selectedMethod,
      challengeData: {
        attempts: 0,
        maxAttempts: 3,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
      expiresAt,
    });

    await this.mfaSessionRepository.save(mfaSession);

    // Send challenge based on method
    let sentTo: string;
    switch (selectedMethod) {
      case MfaMethod.TOTP:
        // TOTP doesn't need to send anything, user uses their app
        break;
      case MfaMethod.SMS:
        sentTo = await this.sendSmsCode(mfaSetting, user);
        break;
      case MfaMethod.EMAIL:
        sentTo = await this.sendEmailCode(mfaSetting, user);
        break;
      default:
        throw new BadRequestException(`MFA method ${selectedMethod} is not supported`);
    }

    // Log audit event
    await this.auditService.logEvent({
      userId,
      action: 'MFA_CHALLENGE_CREATED',
      resource: 'mfa_session',
      details: { method: selectedMethod, sessionId },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      challengeId: sessionId,
      method: selectedMethod,
      expiresAt,
      sentTo,
    };
  }

  async verifyMfaChallenge(
    challengeId: string,
    code: string,
    metadata?: any
  ): Promise<{ success: boolean; userId: string }> {
    const mfaSession = await this.mfaSessionRepository.findOne({
      where: { sessionId: challengeId },
      relations: ['user'],
    });

    if (!mfaSession) {
      throw new NotFoundException('MFA challenge not found');
    }

    if (mfaSession.expiresAt < new Date()) {
      throw new UnauthorizedException('MFA challenge has expired');
    }

    if (mfaSession.status !== MfaStatus.PENDING) {
      throw new BadRequestException('MFA challenge is not pending');
    }

    const attempts = mfaSession.challengeData.attempts || 0;
    const maxAttempts = mfaSession.challengeData.maxAttempts || 3;

    if (attempts >= maxAttempts) {
      mfaSession.status = MfaStatus.FAILED;
      await this.mfaSessionRepository.save(mfaSession);
      
      await this.auditService.logEvent({
        userId: mfaSession.userId,
        action: 'MFA_CHALLENGE_FAILED',
        resource: 'mfa_session',
        details: { reason: 'max_attempts_exceeded', attempts },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      
      throw new UnauthorizedException('Maximum attempts exceeded');
    }

    // Get MFA setting
    const mfaSetting = await this.mfaSettingRepository.findOne({
      where: { userId: mfaSession.userId, method: mfaSession.method, status: MfaStatus.ACTIVE },
    });

    if (!mfaSetting) {
      throw new NotFoundException('MFA setting not found');
    }

    const isValid = await this.verifyCode(
      mfaSession.method,
      mfaSetting.secret,
      code,
      mfaSetting.backupCodes
    );

    if (!isValid) {
      mfaSession.challengeData.attempts = attempts + 1;
      await this.mfaSessionRepository.save(mfaSession);
      
      throw new UnauthorizedException(`Invalid code. ${maxAttempts - attempts - 1} attempts remaining`);
    }

    // Mark challenge as completed
    mfaSession.status = MfaStatus.ACTIVE;
    mfaSession.completedAt = new Date();
    await this.mfaSessionRepository.save(mfaSession);

    // Update last used
    mfaSetting.lastUsedAt = new Date();
    await this.mfaSettingRepository.save(mfaSetting);

    // Log audit event
    await this.auditService.logEvent({
      userId: mfaSession.userId,
      action: 'MFA_CHALLENGE_COMPLETED',
      resource: 'mfa_session',
      details: { method: mfaSession.method },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      success: true,
      userId: mfaSession.userId,
    };
  }

  async disableMfa(userId: string, method: MfaMethod, metadata?: any): Promise<boolean> {
    const mfaSetting = await this.mfaSettingRepository.findOne({
      where: { userId, method, status: MfaStatus.ACTIVE },
    });

    if (!mfaSetting) {
      throw new NotFoundException('MFA method not found or not active');
    }

    mfaSetting.status = MfaStatus.DISABLED;
    await this.mfaSettingRepository.save(mfaSetting);

    // If this was primary, promote another method to primary
    if (mfaSetting.isPrimary) {
      const otherMfa = await this.mfaSettingRepository.findOne({
        where: { userId, status: MfaStatus.ACTIVE, isPrimary: false },
      });
      
      if (otherMfa) {
        otherMfa.isPrimary = true;
        await this.mfaSettingRepository.save(otherMfa);
      }
    }

    // Log audit event
    await this.auditService.logEvent({
      userId,
      action: 'MFA_DISABLED',
      resource: 'mfa_setting',
      details: { method },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return true;
  }

  async getMfaSettings(userId: string): Promise<MfaSetting[]> {
    return this.mfaSettingRepository.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async hasActiveMfa(userId: string): Promise<boolean> {
    const count = await this.mfaSettingRepository.count({
      where: { userId, status: MfaStatus.ACTIVE },
    });
    return count > 0;
  }

  private async verifyCode(
    method: MfaMethod,
    secret: string,
    code: string,
    backupCodes: string[]
  ): Promise<boolean> {
    // Check backup codes first
    if (backupCodes && backupCodes.includes(code)) {
      return true;
    }

    switch (method) {
      case MfaMethod.TOTP:
        return speakeasy.totp.verify({
          secret,
          encoding: 'base32',
          token: code,
          window: 1, // Allow 1 step before/after for clock drift
        });

      case MfaMethod.SMS:
      case MfaMethod.EMAIL:
        // For SMS/Email, we'd verify against a stored code
        // This is simplified - in production, you'd store the sent code securely
        return this.verifyTimeBasedCode(secret, code);

      default:
        return false;
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async sendSmsCode(mfaSetting: MfaSetting, user: User): Promise<string> {
    const code = this.generateTimeBasedCode(mfaSetting.secret);
    
    // In production, integrate with SMS service like Twilio
    console.log(`SMS Code for ${mfaSetting.phoneNumber}: ${code}`);
    
    return mfaSetting.phoneNumber;
  }

  private async sendEmailCode(mfaSetting: MfaSetting, user: User): Promise<string> {
    const code = this.generateTimeBasedCode(mfaSetting.secret);
    
    await this.emailService.sendMfaCode(user.email, code);
    
    return user.email;
  }

  private generateTimeBasedCode(secret: string): string {
    // Simple time-based code generation
    const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute window
    const hash = createHash('sha256')
      .update(secret + timestamp)
      .digest('hex');
    return hash.substring(0, 6).toUpperCase();
  }

  private verifyTimeBasedCode(secret: string, code: string): boolean {
    // Verify code within current and previous time windows
    const currentTimestamp = Math.floor(Date.now() / (5 * 60 * 1000));
    
    for (let offset = 0; offset <= 1; offset++) {
      const timestamp = currentTimestamp - offset;
      const hash = createHash('sha256')
        .update(secret + timestamp)
        .digest('hex');
      const expectedCode = hash.substring(0, 6).toUpperCase();
      
      if (timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
        return true;
      }
    }
    
    return false;
  }

  private async validateUser(userId: string): Promise<User> {
    // This would typically inject UsersService
    // For now, we'll assume user exists
    return { id: userId, email: '', isActive: true } as User;
  }
}
