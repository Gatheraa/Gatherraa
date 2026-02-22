import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { Coupon, CouponUsage } from './entities/coupon.entity';
import { CouponService } from './services/coupon.service';
import { CouponController } from './controllers/coupon.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, CouponUsage]),
    CacheModule.register(),
  ],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponsModule {}
