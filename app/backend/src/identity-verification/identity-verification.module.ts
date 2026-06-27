import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityVerificationController } from './identity-verification.controller';
import { IdentityVerificationService } from './identity-verification.service';
import { IdentityVerification } from './entities/identity-verification.entity';
import { VerificationHistory } from './entities/verification-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdentityVerification, VerificationHistory]),
  ],
  controllers: [IdentityVerificationController],
  providers: [IdentityVerificationService],
  exports: [IdentityVerificationService],
})
export class IdentityVerificationModule {}
