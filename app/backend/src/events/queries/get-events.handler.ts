import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { EventReadModel } from '../entities/event-read.entity';

export class GetEventsQuery {
  constructor(
    public readonly filters: any,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}

@QueryHandler(GetEventsQuery)
export class GetEventsHandler implements IQueryHandler<GetEventsQuery> {
  constructor(
    @InjectRepository(EventReadModel)
    private readonly eventReadModelRepository: Repository<EventReadModel>,
  ) {}

  async execute(query: GetEventsQuery): Promise<{ events: EventReadModel[]; total: number }> {
    const { filters, limit, offset } = query;
    
    const queryBuilder = this.eventReadModelRepository.createQueryBuilder('event');
    
    queryBuilder.where('event.isDeleted = :isDeleted', { isDeleted: false });
    
    if (filters.organizerId) {
      queryBuilder.andWhere('event.organizerId = :organizerId', { organizerId: filters.organizerId });
    }
    
    if (filters.status) {
      queryBuilder.andWhere('event.status = :status', { status: filters.status });
    }
    
    if (filters.type) {
      queryBuilder.andWhere('event.type = :type', { type: filters.type });
    }
    
    if (filters.category) {
      queryBuilder.andWhere('event.category LIKE :category', { category: `%${filters.category}%` });
    }
    
    if (filters.isPublic !== undefined) {
      queryBuilder.andWhere('event.isPublic = :isPublic', { isPublic: filters.isPublic });
    }
    
    if (filters.startDate) {
      queryBuilder.andWhere('event.startDate >= :startDate', { startDate: filters.startDate });
    }
    
    if (filters.endDate) {
      queryBuilder.andWhere('event.endDate <= :endDate', { endDate: filters.endDate });
    }
    
    // New filters
    if (filters.minPrice !== undefined) {
      queryBuilder.andWhere('event.price >= :minPrice', { minPrice: filters.minPrice });
    }
    
    if (filters.maxPrice !== undefined) {
      queryBuilder.andWhere('event.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    
    if (filters.minCapacity !== undefined) {
      queryBuilder.andWhere('event.capacity >= :minCapacity', { minCapacity: filters.minCapacity });
    }
    
    if (filters.maxCapacity !== undefined) {
      queryBuilder.andWhere('event.capacity > event.registeredCount + :minCapacity', { minCapacity: filters.minCapacity });
    }
    
    if (filters.location) {
      queryBuilder.andWhere('event.location LIKE :location', { location: `%${filters.location}%` });
    }
    
    if (filters.isFeatured !== undefined) {
      queryBuilder.andWhere('event.isFeatured = :isFeatured', { isFeatured: filters.isFeatured });
    }
    
    if (filters.searchQuery) {
      queryBuilder.andWhere('(event.title LIKE :query OR event.description LIKE :query)', { query: `%${filters.searchQuery}%` });
    }
    
    // Geolocation filter using Haversine formula (approximate distance)
    if (filters.latitude && filters.longitude && filters.radiusKm) {
      const { latitude, longitude, radiusKm } = filters;
      queryBuilder.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(event.latitude)) * cos(radians(event.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(event.latitude)))) <= :radius`,
        { lat: latitude, lng: longitude, radius: radiusKm }
      );
    }
    
    // Apply pagination
    queryBuilder.skip(offset).take(limit);
    
    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`event.${sortBy}`, sortOrder);
    
    const [events, total] = await queryBuilder.getManyAndCount();
    
    return { events, total };
  }
}
