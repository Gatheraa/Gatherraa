import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import { BookingItem, Seat, SeatStatus } from '../booking/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EventStatsDto, AttendeeDto, RevenueReportDto, SalesAnalyticsDto, MessageAttendeesDto } from './dto/organizer-response.dto';
import { NotificationType, NotificationCategory } from '../notifications/entities/notification.entity';
import { createObjectCsvStringifier } from 'csv-writer';
import { OrganizerGateway } from './organizer.gateway';

@Injectable()
export class OrganizerService {
  private readonly logger = new Logger(OrganizerService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(BookingItem)
    private bookingItemRepository: Repository<BookingItem>,
    @InjectRepository(Seat)
    private seatRepository: Repository<Seat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private organizerGateway: OrganizerGateway,
  ) {}

  async getEventStats(eventId: string): Promise<EventStatsDto> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const totalTickets = await this.seatRepository.count({ where: { eventId } });
    const ticketsSold = await this.seatRepository.count({ where: { eventId, status: SeatStatus.BOOKED } });
    
    // Use query builder for accuracy
    const checkedInResult = await this.bookingItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.booking', 'booking')
      .where('booking.eventId = :eventId', { eventId })
      .andWhere('item.checkedInAt IS NOT NULL')
      .getCount();

    const revenueResult = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('SUM(booking.finalAmount)', 'total')
      .where('booking.eventId = :eventId', { eventId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult.total || '0');

    return {
      totalTickets,
      ticketsSold,
      attendanceRate: ticketsSold > 0 ? (checkedInResult / ticketsSold) * 100 : 0,
      totalRevenue,
      checkedInCount: checkedInResult,
      remainingCount: ticketsSold - checkedInResult,
    };
  }

  async getAttendees(eventId: string, search?: string): Promise<AttendeeDto[]> {
    const query = this.bookingItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.booking', 'booking')
      .innerJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('item.seat', 'seat')
      .where('booking.eventId = :eventId', { eventId });

    if (search) {
      query.andWhere('(user.name LIKE :search OR user.email LIKE :search)', { search: `%${search}%` });
    }

    const items = await query.getMany();

    return items.map(item => ({
      bookingItemId: item.id,
      userId: item.booking.userId,
      userName: item.booking.user.username || 'Anonymous', // Fallback to username
      userEmail: 'hidden@example.com', // For privacy, or return real email if allowed
      seatNumber: item.seat?.number,
      seatSection: item.seat?.section,
      status: item.checkedInAt ? 'Checked In' : 'Pending',
      checkedInAt: item.checkedInAt,
      checkedOutAt: item.checkedOutAt,
    }));
  }

  async checkIn(bookingItemId: string): Promise<BookingItem> {
    const item = await this.bookingItemRepository.findOne({ where: { id: bookingItemId } });
    if (!item) throw new NotFoundException('Booking item not found');

    item.checkedInAt = new Date();
    const savedItem = await this.bookingItemRepository.save(item);
    
    // Emit real-time update
    const eventId = item.booking?.eventId;
    if (eventId) {
      this.organizerGateway.sendUpdate(eventId, 'attendee-checked-in', {
        bookingItemId: savedItem.id,
        checkedInAt: savedItem.checkedInAt,
      });
    }
    
    return savedItem;
  }

  async checkOut(bookingItemId: string): Promise<BookingItem> {
    const item = await this.bookingItemRepository.findOne({ 
      where: { id: bookingItemId },
      relations: ['booking'] 
    });
    if (!item) throw new NotFoundException('Booking item not found');

    item.checkedOutAt = new Date();
    const savedItem = await this.bookingItemRepository.save(item);

    // Emit real-time update
    const eventId = item.booking?.eventId;
    if (eventId) {
      this.organizerGateway.sendUpdate(eventId, 'attendee-checked-out', {
        bookingItemId: savedItem.id,
        checkedOutAt: savedItem.checkedOutAt,
      });
    }

    return savedItem;
  }

  async getRevenueReport(eventId: string): Promise<RevenueReportDto> {
    const totalRevenueResult = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('SUM(booking.finalAmount)', 'total')
      .addSelect('SUM(booking.totalAmount - booking.finalAmount)', 'fees')
      .where('booking.eventId = :eventId', { eventId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .getRawOne();

    const revenueByDay = await this.bookingRepository
      .createQueryBuilder('booking')
      .select("DATE(booking.confirmedAt)", "date")
      .addSelect("SUM(booking.finalAmount)", "amount")
      .where('booking.eventId = :eventId', { eventId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .groupBy("DATE(booking.confirmedAt)")
      .orderBy("date", "ASC")
      .getRawMany();

    return {
      totalRevenue: parseFloat(totalRevenueResult.total || '0'),
      netRevenue: parseFloat(totalRevenueResult.total || '0'), // Assuming net = total for now
      fees: parseFloat(totalRevenueResult.fees || '0'),
      revenueByDay: revenueByDay.map(r => ({ date: r.date, amount: parseFloat(r.amount) })),
    };
  }

  async getSalesAnalytics(eventId: string): Promise<SalesAnalyticsDto> {
    const totalSales = await this.bookingRepository.count({
      where: { eventId, status: BookingStatus.CONFIRMED },
    });

    const salesTrends = await this.bookingRepository
      .createQueryBuilder('booking')
      .select("DATE(booking.confirmedAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where('booking.eventId = :eventId', { eventId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .groupBy("DATE(booking.confirmedAt)")
      .orderBy("date", "ASC")
      .getRawMany();

    return {
      totalSales,
      salesTrends: salesTrends.map(s => ({ date: s.date, count: parseInt(s.count) })),
    };
  }

  async messageAttendees(eventId: string, messageDto: MessageAttendeesDto): Promise<void> {
    const bookings = await this.bookingRepository.find({
      where: { eventId, status: BookingStatus.CONFIRMED },
      select: ['userId'],
    });

    const userIds = Array.from(new Set(bookings.map(b => b.userId)));

    if (userIds.length > 0) {
      await this.notificationsService.sendBulkNotifications({
        userIds,
        types: [NotificationType.IN_APP, NotificationType.EMAIL],
        category: NotificationCategory.EVENT_REMINDER,
        title: messageDto.subject,
        message: messageDto.content,
      });
    }
  }

  async exportAttendees(eventId: string): Promise<string> {
    const attendees = await this.getAttendees(eventId);
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'userName', title: 'Name' },
        { id: 'userEmail', title: 'Email' },
        { id: 'seatNumber', title: 'Seat' },
        { id: 'seatSection', title: 'Section' },
        { id: 'status', title: 'Status' },
        { id: 'checkedInAt', title: 'Checked In At' },
      ],
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(attendees);
  }
}
