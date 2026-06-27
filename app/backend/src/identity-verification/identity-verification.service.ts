import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityVerification,
  VerificationStep,
  VerificationStatus,
} from './entities/identity-verification.entity';
import {
  VerificationHistory,
  VerificationAction,
} from './entities/verification-history.entity';
import { SubmitStepDto } from './dto/submit-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import {
  VerificationStepResponse,
  VerificationHistoryResponse,
  VerificationSummaryResponse,
} from './dto/verification-response.dto';

@Injectable()
export class IdentityVerificationService {
  constructor(
    @InjectRepository(IdentityVerification)
    private readonly verificationRepo: Repository<IdentityVerification>,
    @InjectRepository(VerificationHistory)
    private readonly historyRepo: Repository<VerificationHistory>,
  ) {}

  async getSummary(userId: string): Promise<VerificationSummaryResponse> {
    const steps = await this.verificationRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    const history = await this.historyRepo.find({
      where: { verification: { userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const completed = steps.filter(
      (s) => s.status === VerificationStatus.COMPLETED,
    ).length;
    const overallProgress = steps.length
      ? Math.round((completed / steps.length) * 100)
      : 0;
    const isVerified = steps.every(
      (s) => s.status === VerificationStatus.COMPLETED,
    );

    return {
      steps: steps.map(this.toStepResponse),
      history: history.map(this.toHistoryResponse),
      overallProgress,
      isVerified: steps.length > 0 && isVerified,
    };
  }

  async getSteps(userId: string): Promise<VerificationStepResponse[]> {
    const steps = await this.verificationRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return steps.map(this.toStepResponse);
  }

  async getHistory(userId: string): Promise<VerificationHistoryResponse[]> {
    const history = await this.historyRepo.find({
      where: { verification: { userId } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return history.map(this.toHistoryResponse);
  }

  async submitStep(
    userId: string,
    step: VerificationStep,
    dto: SubmitStepDto,
  ): Promise<VerificationStepResponse> {
    let verification = await this.verificationRepo.findOne({
      where: { userId, step },
    });

    if (!verification) {
      verification = this.verificationRepo.create({
        userId,
        step,
        status: VerificationStatus.IN_PROGRESS,
        metadata: dto.metadata,
        attemptCount: 1,
      });
    } else {
      if (verification.status === VerificationStatus.COMPLETED) {
        throw new BadRequestException(
          `Step '${step}' is already completed`,
        );
      }
      if (verification.attemptCount >= verification.maxAttempts) {
        throw new BadRequestException(
          `Step '${step}' has exceeded maximum attempts (${verification.maxAttempts})`,
        );
      }

      verification.status = VerificationStatus.IN_PROGRESS;
      verification.attemptCount += 1;
      if (dto.metadata) {
        verification.metadata = {
          ...(verification.metadata || {}),
          ...dto.metadata,
        };
      }
      verification.rejectionReason = undefined;
    }

    const saved = await this.verificationRepo.save(verification);

    await this.addHistoryEntry(
      saved.id,
      VerificationAction.SUBMITTED,
      `Step '${step}' submitted for verification`,
      dto.metadata,
    );

    return this.toStepResponse(saved);
  }

  async retryStep(
    userId: string,
    step: VerificationStep,
  ): Promise<VerificationStepResponse> {
    const verification = await this.verificationRepo.findOne({
      where: { userId, step },
    });

    if (!verification) {
      throw new NotFoundException(
        `No verification found for step '${step}'`,
      );
    }

    if (verification.status === VerificationStatus.COMPLETED) {
      throw new BadRequestException(
        `Step '${step}' is already completed and cannot be retried`,
      );
    }

    if (verification.attemptCount >= verification.maxAttempts) {
      throw new BadRequestException(
        `Step '${step}' has exceeded maximum attempts (${verification.maxAttempts}). Contact support.`,
      );
    }

    verification.status = VerificationStatus.PENDING;
    verification.attemptCount += 1;
    verification.rejectionReason = undefined;

    const saved = await this.verificationRepo.save(verification);

    await this.addHistoryEntry(
      saved.id,
      VerificationAction.RETRIED,
      `Step '${step}' retry initiated (attempt ${saved.attemptCount}/${saved.maxAttempts})`,
    );

    return this.toStepResponse(saved);
  }

  async updateStepStatus(
    userId: string,
    step: VerificationStep,
    dto: UpdateStepDto,
  ): Promise<VerificationStepResponse> {
    const verification = await this.verificationRepo.findOne({
      where: { userId, step },
    });

    if (!verification) {
      throw new NotFoundException(
        `No verification found for step '${step}'`,
      );
    }

    verification.status = dto.status;
    if (dto.metadata) {
      verification.metadata = {
        ...(verification.metadata || {}),
        ...dto.metadata,
      };
    }
    if (dto.rejectionReason) {
      verification.rejectionReason = dto.rejectionReason;
    }
    if (dto.status === VerificationStatus.COMPLETED) {
      verification.completedAt = new Date();
    }

    const saved = await this.verificationRepo.save(verification);

    let action: VerificationAction;
    let message: string;
    switch (dto.status) {
      case VerificationStatus.COMPLETED:
        action = VerificationAction.APPROVED;
        message = `Step '${step}' approved`;
        break;
      case VerificationStatus.FAILED:
        action = VerificationAction.REJECTED;
        message = dto.rejectionReason || `Step '${step}' rejected`;
        break;
      default:
        action = VerificationAction.SUBMITTED;
        message = `Step '${step}' updated to ${dto.status}`;
    }

    await this.addHistoryEntry(saved.id, action, message, dto.metadata);

    return this.toStepResponse(saved);
  }

  async initializeDefaultSteps(userId: string): Promise<void> {
    const existingSteps = await this.verificationRepo.count({
      where: { userId },
    });
    if (existingSteps > 0) return;

    const defaultSteps = [
      { step: VerificationStep.EMAIL, label: 'Email Verification' },
      { step: VerificationStep.PHONE, label: 'Phone Verification' },
      { step: VerificationStep.GOVERNMENT_ID, label: 'Government ID' },
      { step: VerificationStep.FACE_MATCH, label: 'Face Match' },
      { step: VerificationStep.WALLET, label: 'Wallet Confirmation' },
      { step: VerificationStep.ADDRESS, label: 'Address Verification' },
    ];

    const entities = defaultSteps.map((s) =>
      this.verificationRepo.create({
        userId,
        step: s.step,
        status: VerificationStatus.PENDING,
        isRequired: true,
      }),
    );

    await this.verificationRepo.save(entities);
  }

  private async addHistoryEntry(
    verificationId: string,
    action: VerificationAction,
    message?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const entry = this.historyRepo.create({
      verificationId,
      action,
      message,
      metadata,
    });
    await this.historyRepo.save(entry);
  }

  private toStepResponse(
    v: IdentityVerification,
  ): VerificationStepResponse {
    return {
      id: v.id,
      step: v.step,
      status: v.status,
      metadata: v.metadata,
      rejectionReason: v.rejectionReason,
      attemptCount: v.attemptCount,
      maxAttempts: v.maxAttempts,
      isRequired: v.isRequired,
      completedAt: v.completedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private toHistoryResponse(
    h: VerificationHistory,
  ): VerificationHistoryResponse {
    return {
      id: h.id,
      action: h.action,
      message: h.message,
      metadata: h.metadata,
      createdAt: h.createdAt,
    };
  }
}
