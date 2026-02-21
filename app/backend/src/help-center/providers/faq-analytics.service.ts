import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class FaqAnalyticsService {
  constructor(private readonly es: ElasticsearchService) {}

  async trackView(faqId: string) {
    await this.es.index({
      index: 'faq_analytics',
      document: {
        faqId,
        viewedAt: new Date(),
      },
    });
  }
}
