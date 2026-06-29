import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IdentityVerificationService } from './identity-verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerificationStep } from './entities/identity-verification.entity';
import { SubmitStepDto } from './dto/submit-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import {
  VerificationStepResponse,
  VerificationHistoryResponse,
  VerificationSummaryResponse,
} from './dto/verification-response.dto';

@Controller('identity-verification')
@UseGuards(JwtAuthGuard)
export class IdentityVerificationController {
  constructor(
    private readonly verificationService: IdentityVerificationService,
  ) {}

  @Get('summary')
  getSummary(@Req() req: any): Promise<VerificationSummaryResponse> {
    return this.verificationService.getSummary(req.user.id);
  }

  @Get('steps')
  getSteps(@Req() req: any): Promise<VerificationStepResponse[]> {
    return this.verificationService.getSteps(req.user.id);
  }

  @Get('history')
  getHistory(@Req() req: any): Promise<VerificationHistoryResponse[]> {
    return this.verificationService.getHistory(req.user.id);
  }

  @Post('steps/:step/submit')
  submitStep(
    @Req() req: any,
    @Param('step') step: VerificationStep,
    @Body() dto: SubmitStepDto,
  ): Promise<VerificationStepResponse> {
    return this.verificationService.submitStep(req.user.id, step, dto);
  }

  @Post('steps/:step/retry')
  retryStep(
    @Req() req: any,
    @Param('step') step: VerificationStep,
  ): Promise<VerificationStepResponse> {
    return this.verificationService.retryStep(req.user.id, step);
  }

  @Patch('steps/:step')
  updateStepStatus(
    @Req() req: any,
    @Param('step') step: VerificationStep,
    @Body() dto: UpdateStepDto,
  ): Promise<VerificationStepResponse> {
    return this.verificationService.updateStepStatus(
      req.user.id,
      step,
      dto,
    );
  }

  @Post('initialize')
  initializeSteps(@Req() req: any): Promise<{ message: string }> {
    return this.verificationService
      .initializeDefaultSteps(req.user.id)
      .then(() => ({ message: 'Default verification steps created' }));
  }
}
