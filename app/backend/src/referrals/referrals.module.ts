import { Module } from '@nestjs/common';
import { Referral } from './entities/referral.entity';
import { ReferralAccount } from './entities/referral-account.entity';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferralCode,
      Referral,
      ReferralReward,
      ReferralAccount,
    ]),
    UsersModule,
  ],
  providers: [ReferralsService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule { }
