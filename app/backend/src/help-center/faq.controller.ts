import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateFaqDto } from './dto/create-faq.dto';
import { FaqService } from './providers/faq.service';
import { FaqSearchService } from './providers/faq-search.service';
import { FaqFeedbackService } from './providers/faq-feedback.service';

@Controller('faqs')
export class FaqController {
  constructor(
    private readonly faqService: FaqService,
    private readonly faqSearchService: FaqSearchService,
    private readonly faqFeedbackService: FaqFeedbackService,
  ) {}

  // 🔹 Public: Get all FAQs
  @Get()
  async findAll() {
    return this.faqService.findAll();
  }

  // 🔹 Public: Get single FAQ
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.faqService.findOne(id);
  }

  // 🔹 Public: Search FAQs
  @Get('/search/query')
  async search(@Query('q') query: string) {
    return this.faqSearchService.search(query);
  }

  // 🔹 Public: Submit feedback
  @Post(':id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() body: { helpful: boolean; comment?: string },
  ) {
    return this.faqFeedbackService.submitFeedback(
      id,
      body.helpful,
      body.comment,
    );
  }

  // 🔹 Admin: Create FAQ
  @Post()
  async create(@Body() dto: CreateFaqDto) {
    const faq = await this.faqService.create(dto);

    // Index into Elasticsearch
    await this.faqSearchService.indexFaq(faq);

    return faq;
  }
}
