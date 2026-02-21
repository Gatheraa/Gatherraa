import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class FaqSearchService {
  constructor(private readonly es: ElasticsearchService) {}

  async indexFaq(faq: any) {
    await this.es.index({
      index: 'faqs',
      id: faq.id,
      document: {
        title: faq.title,
        content: faq.content,
        category: faq.category?.name,
      },
    });
  }

  async search(query: string) {
    return this.es.search({
      index: 'faqs',
      query: {
        multi_match: {
          query,
          fields: ['title^2', 'content'],
          fuzziness: 'AUTO',
        },
      },
    });
  }
}
