import { Injectable } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from "../entities/faq.entity";
import { FaqFeedback } from "../entities/faq-feedback.entity";

@Injectable()
export class FaqFeedbackService {
  constructor(
    @InjectRepository(FaqFeedback)
    private feedbackRepo: Repository<FaqFeedback>,

    @InjectRepository(Faq)
    private faqRepo: Repository<Faq>,
  ) {}

  async submitFeedback(faqId: string, helpful: boolean, comment?: string) {
    const faq = await this.faqRepo.findOneBy({ id: faqId });

    if (!faq) {
      throw new Error('FAQ not found');
    }

    await this.feedbackRepo.save({
      faq,
      helpful,
      comment,
      createdAt: new Date(),
    });

    if (helpful) faq.helpfulCount++;
    else faq.notHelpfulCount++;

    await this.faqRepo.save(faq);
  }
}