import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { CouponService } from '../services/coupon.service';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  ApplyCouponDto,
  BulkGenerateCouponsDto,
  CouponQueryDto,
} from '../dto/coupon.dto';

@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async createCoupon(@Body() dto: CreateCouponDto, @Request() req) {
    return this.couponService.createCoupon(dto, req.user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @Request() req,
  ) {
    return this.couponService.updateCoupon(id, dto, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async getCouponById(@Param('id') id: string) {
    return this.couponService.getCouponById(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async queryCoupons(@Query() query: CouponQueryDto) {
    return this.couponService.queryCoupons(query);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCoupon(@Param('id') id: string) {
    await this.couponService.deleteCoupon(id);
  }

  @Post('validate')
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.couponService.validateCoupon(dto);
  }

  @Post('apply')
  async applyCoupon(@Body() dto: ApplyCouponDto) {
    return this.couponService.applyCoupon(dto);
  }

  @Post('bulk-generate')
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async bulkGenerateCoupons(
    @Body() dto: BulkGenerateCouponsDto,
    @Request() req,
  ) {
    return this.couponService.bulkGenerateCoupons(dto, req.user.id);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  async getCouponUsageStats(@Param('id') id: string) {
    return this.couponService.getCouponUsageStats(id);
  }

  @Get('user/history')
  async getUserCouponHistory(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.couponService.getUserCouponHistory(
      req.user.id,
      limitNum,
      offsetNum,
    );
  }
}
