export class GetEventsQuery {
  constructor(
    public readonly filters: {
      organizerId?: string;
      organizerName?: string;
      status?: string;
      type?: string;
      category?: string;
      isPublic?: boolean;
      startDate?: Date;
      endDate?: Date;
      minPrice?: number;
      maxPrice?: number;
      location?: string;
      isFeatured?: boolean;
    },
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}