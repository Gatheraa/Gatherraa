import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// DTOs for brevity
class GenerateCodeDto {
  maxUses?: number;
  prefix?: string;
}

class RedeemDto {
  code: string;
  idempotencyKey?: string;
  metadata?: any;
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) { }

  @UseGuards(JwtAuthGuard)
  @Post('code')
  async generateCode (@Req() req, @Body() body: GenerateCodeDto) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('Missing user');
    return this.referralsService.generateCode(userId, {
      maxUses: body.maxUses,
      prefix: body.prefix,
    });
  }

  // redeem a code - authenticated users
  @UseGuards(JwtAuthGuard)
  @Post('redeem')
  async redeem (@Req() req, @Body() body: RedeemDto) {
    const userId = req.user?.sub;
    const ip = (req.ip ||
      (req.headers && req.headers['x-forwarded-for']) ||
      null) as string | null;
    if (!body?.code) throw new BadRequestException('code required');
    return this.referralsService.redeemCode(userId, body.code, {
      ip: ip ?? undefined,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history (@Req() req) {
    const userId = req.user?.sub;
    return this.referralsService.getHistory(userId);
  }

  // analytics — could be restricted to admins (left open, you can add RolesGuard)
  @UseGuards(JwtAuthGuard)
  @Get('analytics')
  async analytics () {
    return this.referralsService.getAnalytics();
  }
}
