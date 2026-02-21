import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../entities/faq.entity';
import { FaqCategory } from '../entities/faq-category.entity';
import { FaqVersion } from '../entities/faq-version.entity';
import { CreateFaqDto } from '../dto/create-faq.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq)
    private faqRepo: Repository<Faq>,

    @InjectRepository(FaqCategory)
    private categoryRepo: Repository<FaqCategory>,

    @InjectRepository(FaqVersion)
    private versionRepo: Repository<FaqVersion>,
  ) {}

  async create(dto: CreateFaqDto) {
    const category = await this.categoryRepo.findOneBy({ id: dto.categoryId });

    const faq = this.faqRepo.create({
      ...dto,
      category: category || undefined,
    });

    const saved = await this.faqRepo.save(faq);

    await this.versionRepo.save({
      faq: saved,
      contentSnapshot: saved.content,
      versionNumber: 1,
      createdAt: new Date(),
    });

    return saved;
  }

  async findAll() {
    return this.faqRepo.find({ relations: ['category'] });
  }

  async findOne(id: string) {
    return this.faqRepo.findOne({
      where: { id },
      relations: ['category'],
    });
  }
}
