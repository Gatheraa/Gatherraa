import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventReadModel } from '../entities/event-read.entity';

@Injectable()
export class EventRecommendationService {
  constructor(
    @InjectRepository(EventReadModel)
    private readonly eventReadModelRepository: Repository<EventReadModel>,
  ) {}

  async getRecommendedEvents(userId?: string, limit: number = 10): Promise<EventReadModel[]> {
    // Simple recommendation: popular events (high registeredCount) or featured
    const queryBuilder = this.eventReadModelRepository.createQueryBuilder('event')
      .where('event.isDeleted = false')
      .andWhere('event.status = :status', { status: 'published' })
      .andWhere('event.isFeatured = true OR event.registeredCount > 10') // Example logic
      .orderBy('event.registeredCount', 'DESC')
      .limit(limit);
    
    return await queryBuilder.getMany();
  }
}