import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { PaymentService } from '../services/payment.service';
import { StripeService } from '../services/stripe.service';
import { CryptoPaymentService } from '../services/crypto-payment.service';
import { ReconciliationService } from '../services/reconciliation.service';
import {
  CreatePaymentDto,
  InitiateStripePaymentDto,
  ConfirmStripePaymentDto,
  InitiateCryptoPaymentDto,
  VerifyCryptoPaymentDto,
  CreateRefundDto,
  SavePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentListDto,
} from '../dto/payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private stripeService: StripeService,
    private cryptoPaymentService: CryptoPaymentService,
    private reconciliationService: ReconciliationService,
  ) {}

  /**
   * Create a new payment
   */
  @Post()
  async createPayment(@Body() dto: CreatePaymentDto, @Req() request: Request): Promise<any> {
    const ipAddress = this.getClientIpAddress(request);
    const payment = await this.paymentService.createPayment(dto, ipAddress);

    return {
      id: payment.id,
      status: payment.status,
      method: payment.method,
      amount: payment.amountDisplayValue,
      currency: payment.currency,
      createdAt: payment.createdAt,
    };
  }

  /**
   * Initiate Stripe payment
   */
  @Post('stripe/initiate')
  async initiateStripePayment(
    @Body() dto: InitiateStripePaymentDto,
    @Req() request: Request,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    return this.stripeService.initiatePayment(dto);
  }

  /**
   * Confirm Stripe payment
   */
  @Post('stripe/confirm')
  async confirmStripePayment(@Body() dto: ConfirmStripePaymentDto): Promise<any> {
    const payment = await this.stripeService.confirmPayment(dto);

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amountDisplayValue,
      currency: payment.currency,
    };
  }

  /**
   * Initiate crypto payment
   */
  @Post('crypto/initiate')
  async initiateCryptoPayment(@Body() dto: InitiateCryptoPaymentDto): Promise<any> {
    // Validate wallet address
    if (!this.cryptoPaymentService.isValidAddress(dto.fromAddress, dto.method)) {
      throw new BadRequestException('Invalid wallet address');
    }

    const payment = await this.paymentService.createPayment({
      ...dto,
      userId: dto.userId,
      type: dto.type,
      currency: 'ETH', // or appropriate crypto
      amount: dto.amount,
    });

    return {
      id: payment.id,
      paymentAddress: process.env[`${dto.method.toUpperCase()}_CONTRACT_ADDRESS`],
      amount: dto.amount,
      fromAddress: dto.fromAddress,
      currency: dto.method,
    };
  }

  /**
   * Verify crypto payment
   */
  @Post('crypto/verify')
  async verifyCryptoPayment(@Body() dto: VerifyCryptoPaymentDto): Promise<any> {
    const payment = await this.cryptoPaymentService.verifyTransaction(dto);

    return {
      id: payment.id,
      status: payment.status,
      transactionHash: payment.transactionHash,
      blockConfirmations: payment.blockConfirmations,
      amount: payment.amountDisplayValue,
    };
  }

  /**
   * Get payment by ID
   */
  @Get(':id')
  async getPayment(@Param('id') id: string): Promise<any> {
    const payment = await this.paymentService.getPaymentById(id);

    return {
      id: payment.id,
      userId: payment.userId,
      method: payment.method,
      type: payment.type,
      amount: payment.amountDisplayValue,
      currency: payment.currency,
      status: payment.status,
      refundedAmount: payment.refundedAmount,
      transactionHash: payment.transactionHash,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Get user payment history
   */
  @Get('user/:userId/history')
  async getUserPayments(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ): Promise<any> {
    const [payments, total] = await this.paymentService.getUserPayments(userId, limit, offset);

    return {
      data: payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amountDisplayValue,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Refund a payment
   */
  @Post(':id/refund')
  async refundPayment(
    @Param('id') paymentId: string,
    @Body() dto: CreateRefundDto,
  ): Promise<any> {
    const refund = await this.paymentService.refundPayment({
      ...dto,
      paymentId,
    });

    return {
      id: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
      createdAt: refund.createdAt,
    };
  }

  /**
   * Get payment refunds
   */
  @Get(':id/refunds')
  async getPaymentRefunds(@Param('id') paymentId: string): Promise<any> {
    const refunds = await this.paymentService.getPaymentRefunds(paymentId);

    return {
      data: refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      total: refunds.length,
    };
  }

  /**
   * Save payment method
   */
  @Post('methods/save')
  async savePaymentMethod(
    @Body() dto: SavePaymentMethodDto,
    @Req() request: any,
  ): Promise<any> {
    const userId = request.user.id;

    const method = await this.paymentService.savePaymentMethod(
      userId,
      { stripePaymentMethodId: dto.stripePaymentMethodId },
      dto.nickname,
      dto.setAsDefault,
    );

    return {
      id: method.id,
      type: method.type,
      nickname: method.nickname,
      last4: method.last4,
      isDefault: method.isDefault,
    };
  }

  /**
   * Get saved payment methods
   */
  @Get('methods')
  async getSavedPaymentMethods(@Req() request: any): Promise<any> {
    const userId = request.user.id;
    const methods = await this.paymentService.getSavedPaymentMethods(userId);

    return {
      data: methods.map((m) => ({
        id: m.id,
        type: m.type,
        nickname: m.nickname,
        last4: m.last4,
        brand: m.brand,
        isDefault: m.isDefault,
      })),
      total: methods.length,
    };
  }

  /**
   * Update payment method
   */
  @Put('methods/:id')
  async updatePaymentMethod(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
    @Req() request: any,
  ): Promise<any> {
    const userId = request.user.id;

    if (dto.isDefault) {
      const method = await this.paymentService.setDefaultPaymentMethod(userId, id);
      return {
        id: method.id,
        isDefault: method.isDefault,
      };
    }

    return { id, updated: true };
  }

  /**
   * Delete payment method
   */
  @Delete('methods/:id')
  async deletePaymentMethod(
    @Param('id') id: string,
    @Req() request: any,
  ): Promise<any> {
    const userId = request.user.id;
    await this.paymentService.deleteSavedPaymentMethod(userId, id);

    return { deleted: true };
  }

  /**
   * Get payment analytics
   */
  @Get('analytics/summary')
  async getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<any> {
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    return this.paymentService.getPaymentAnalytics(from, to);
  }

  /**
   * Get reconciliation reports
   */
  @Get('reconciliation/reports')
  async getReconciliationReports(@Query('limit') limit: number = 30): Promise<any> {
    const reports = await this.reconciliationService.getReconciliationReports(limit);

    return {
      data: reports.map((r) => ({
        id: r.id,
        date: r.date,
        provider: r.provider,
        status: r.status,
        totalPayments: r.totalPaymentsProcessed,
        totalAmount: r.totalAmountProcessed,
        discrepancies: r.discrepancyCount,
      })),
      total: reports.length,
    };
  }

  /**
   * Run reconciliation manually
   */
  @Post('reconciliation/run')
  async runReconciliation(@Query('provider') provider: string = 'stripe'): Promise<any> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let result;

    if (provider === 'stripe') {
      result = await this.reconciliationService.reconcileStripe(yesterday, tomorrow);
    } else if (provider === 'blockchain') {
      result = await this.reconciliationService.reconcileCrypto(yesterday, tomorrow);
    } else {
      throw new BadRequestException('Invalid provider');
    }

    return {
      id: result.id,
      provider: result.provider,
      status: result.status,
      discrepancies: result.discrepancyCount,
      completedAt: result.completedAt,
    };
  }

  /**
   * Retry a failed payment
   */
  @Post(':id/retry')
  async retryPayment(@Param('id') id: string): Promise<any> {
    const payment = await this.paymentService.retryPayment(id);

    return {
      id: payment.id,
      status: payment.status,
      retryCount: payment.retryCount,
      nextRetryAt: payment.nextRetryAt,
    };
  }

  /**
   * Health check
   */
  @Get('health/check')
  health(): { status: string } {
    return { status: 'payment service is operational' };
  }

  /**
   * Helper to extract client IP
   */
  private getClientIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}
