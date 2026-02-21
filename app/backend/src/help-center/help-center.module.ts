import { Module } from '@nestjs/common';
import { FaqController } from './faq.controller';
import { FaqService } from './providers/faq.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from './entities/faq.entity';
import { FaqCategory } from './entities/faq-category.entity';
import { FaqVersion } from './entities/faq-version.entity';
import { FaqFeedback } from './entities/faq-feedback.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Faq, FaqCategory, FaqVersion, FaqFeedback]),
  ],
  controllers: [FaqController],
  providers: [FaqService],
})
export class HelpCenterModule {}
