import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SorobanVerificationRecord } from './entities/soroban-verification.entity';
import { SorobanVerificationService } from './soroban-verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([SorobanVerificationRecord])],
  providers: [SorobanVerificationService],
  exports: [SorobanVerificationService],
})
export class SorobanVerificationModule {}
