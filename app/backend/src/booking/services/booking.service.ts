import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Booking, BookingItem, BookingStatus } from '../entities/booking.entity';
import { SeatService } from './seat.service';
import { PricingService } from './pricing.service';
import { CartService } from './cart.service';
import {
    CreateBookingDto,
    ApplyPromoCodeDto,
    BookingResponseDto,
} from '../dto/booking.dto';

const RESERVATION_MINUTES = 15;

@Injectable()
export class BookingService {
    constructor(
        @InjectRepository(Booking)
        private bookingRepository: Repository<Booking>,
        @InjectRepository(BookingItem)
        private bookingItemRepository: Repository<BookingItem>,
        private readonly seatService: SeatService,
        private readonly pricingService: PricingService,
        private readonly cartService: CartService,
    ) { }

    /**
     * Create a booking: reserve seats, calculate pricing, persist booking.
     * This implements the saga-inspired flow:
     *   1. Reserve seats (optimistic lock)
     *   2. Calculate price
     *   3. Persist booking with PENDING status
     *   4. Clear cart
     * On failure at any step, previously completed steps are compensated.
     */
    async createBooking(
        dto: CreateBookingDto,
        userId: string,
    ): Promise<BookingResponseDto> {
        // Step 1: Reserve seats
        let reservedSeats;
        try {
            reservedSeats = await this.seatService.reserveSeats(
                dto.seatIds,
                userId,
                RESERVATION_MINUTES,
            );
        } catch (error) {
            throw error; // ConflictException or NotFoundException from seat service
        }

        // Step 2: Calculate pricing
        let pricing;
        try {
            pricing = await this.pricingService.calculatePrice(
                reservedSeats,
                userId,
                dto.promoCode,
                dto.currency,
            );
        } catch (error) {
            // Compensate: release seats
            await this.seatService.releaseSeats(dto.seatIds);
            throw error;
        }

        // Step 3: Persist booking
        try {
            const reservationExpiresAt = new Date(
                Date.now() + RESERVATION_MINUTES * 60 * 1000,
            );

            const booking = this.bookingRepository.create({
                userId,
                eventId: dto.eventId,
                status: BookingStatus.PENDING,
                totalAmount: pricing.subtotal,
                discountAmount: pricing.discountAmount,
                finalAmount: pricing.total,
                currency: pricing.currency,
                promoCode: pricing.promoCode,
                reservationExpiresAt,
            });

            const savedBooking = await this.bookingRepository.save(booking);

            // Create booking items
            const items = pricing.items.map((item) =>
                this.bookingItemRepository.create({
                    bookingId: savedBooking.id,
                    seatId: item.seatId,
                    unitPrice: item.basePrice,
                    finalPrice: item.finalPrice,
                }),
            );

            await this.bookingItemRepository.save(items);

            // Step 4: Clear cart
            await this.cartService.clearCart(userId, dto.eventId);

            // Reload with items
            const result = await this.bookingRepository.findOne({
                where: { id: savedBooking.id },
                relations: ['items'],
            });

            return this.toResponseDto(result!);
        } catch (error) {
            // Compensate: release seats
            await this.seatService.releaseSeats(dto.seatIds);
            throw error;
        }
    }

    /**
     * Confirm a pending booking
     */
    async confirmBooking(
        bookingId: string,
        userId: string,
    ): Promise<BookingResponseDto> {
        const booking = await this.bookingRepository.findOne({
            where: { id: bookingId },
            relations: ['items'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.userId !== userId) {
            throw new BadRequestException('Booking does not belong to this user');
        }

        if (booking.status !== BookingStatus.PENDING) {
            throw new ConflictException(
                `Cannot confirm booking with status: ${booking.status}`,
            );
        }

        // Check if reservation has expired
        if (
            booking.reservationExpiresAt &&
            new Date() > booking.reservationExpiresAt
        ) {
            // Expire the booking
            await this.expireBooking(booking);
            throw new ConflictException('Booking reservation has expired');
        }

        // Mark seats as booked
        const seatIds = booking.items.map((item) => item.seatId);
        await this.seatService.confirmSeats(seatIds);

        // Update booking status
        booking.status = BookingStatus.CONFIRMED;
        booking.confirmedAt = new Date();
        booking.reservationExpiresAt = null;

        const saved = await this.bookingRepository.save(booking);
        return this.toResponseDto(saved);
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(
        bookingId: string,
        userId: string,
        reason?: string,
    ): Promise<BookingResponseDto> {
        const booking = await this.bookingRepository.findOne({
            where: { id: bookingId },
            relations: ['items'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.userId !== userId) {
            throw new BadRequestException('Booking does not belong to this user');
        }

        if (
            booking.status === BookingStatus.CANCELLED ||
            booking.status === BookingStatus.EXPIRED
        ) {
            throw new ConflictException(
                `Booking is already ${booking.status}`,
            );
        }

        // Release seats
        const seatIds = booking.items.map((item) => item.seatId);
        await this.seatService.releaseSeats(seatIds);

        // Update booking
        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = reason || null;
        booking.reservationExpiresAt = null;

        const saved = await this.bookingRepository.save(booking);
        return this.toResponseDto(saved);
    }

    /**
     * Apply a promo code to an existing pending booking
     */
    async applyPromoCode(
        dto: ApplyPromoCodeDto,
        userId: string,
    ): Promise<BookingResponseDto> {
        const booking = await this.bookingRepository.findOne({
            where: { id: dto.bookingId },
            relations: ['items'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.userId !== userId) {
            throw new BadRequestException('Booking does not belong to this user');
        }

        if (booking.status !== BookingStatus.PENDING) {
            throw new ConflictException('Can only apply promo code to pending bookings');
        }

        // Fetch seats for re-pricing
        const seatIds = booking.items.map((item) => item.seatId);
        const seats = await this.seatService.getSeatsByIds(seatIds);

        // Recalculate pricing with promo code
        const pricing = await this.pricingService.calculatePrice(
            seats,
            userId,
            dto.promoCode,
            booking.currency,
        );

        // Update booking amounts
        booking.totalAmount = pricing.subtotal;
        booking.discountAmount = pricing.discountAmount;
        booking.finalAmount = pricing.total;
        booking.promoCode = pricing.promoCode;

        // Update item final prices
        for (const item of booking.items) {
            const priceItem = pricing.items.find((p) => p.seatId === item.seatId);
            if (priceItem) {
                item.finalPrice = priceItem.finalPrice;
            }
        }

        await this.bookingItemRepository.save(booking.items);
        const saved = await this.bookingRepository.save(booking);
        return this.toResponseDto(saved);
    }

    /**
     * Get a booking by ID
     */
    async getBooking(bookingId: string, userId: string): Promise<BookingResponseDto> {
        const booking = await this.bookingRepository.findOne({
            where: { id: bookingId },
            relations: ['items'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.userId !== userId) {
            throw new BadRequestException('Booking does not belong to this user');
        }

        return this.toResponseDto(booking);
    }

    /**
     * Get all bookings for a user
     */
    async getUserBookings(userId: string): Promise<BookingResponseDto[]> {
        const bookings = await this.bookingRepository.find({
            where: { userId },
            relations: ['items'],
            order: { createdAt: 'DESC' },
        });

        return bookings.map((b) => this.toResponseDto(b));
    }

    /**
     * Expire a single booking (internal helper)
     */
    private async expireBooking(booking: Booking): Promise<void> {
        const seatIds = booking.items.map((item) => item.seatId);
        await this.seatService.releaseSeats(seatIds);

        booking.status = BookingStatus.EXPIRED;
        booking.reservationExpiresAt = null;
        await this.bookingRepository.save(booking);
    }

    /**
     * Scheduled task: expire pending bookings whose reservation has lapsed.
     * Runs every minute.
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async handleExpiredReservations(): Promise<void> {
        const now = new Date();

        const expiredBookings = await this.bookingRepository.find({
            where: { status: BookingStatus.PENDING },
            relations: ['items'],
        });

        for (const booking of expiredBookings) {
            if (
                booking.reservationExpiresAt &&
                now > booking.reservationExpiresAt
            ) {
                await this.expireBooking(booking);
            }
        }

        // Also expire seat-level reservations (defensive)
        await this.seatService.expireReservations();
    }

    private toResponseDto(booking: Booking): BookingResponseDto {
        return {
            id: booking.id,
            userId: booking.userId,
            eventId: booking.eventId,
            status: booking.status,
            totalAmount: Number(booking.totalAmount),
            discountAmount: Number(booking.discountAmount),
            finalAmount: Number(booking.finalAmount),
            currency: booking.currency,
            promoCode: booking.promoCode,
            reservationExpiresAt: booking.reservationExpiresAt,
            confirmedAt: booking.confirmedAt,
            cancelledAt: booking.cancelledAt,
            cancellationReason: booking.cancellationReason,
            items: (booking.items || []).map((item) => ({
                id: item.id,
                seatId: item.seatId,
                unitPrice: Number(item.unitPrice),
                finalPrice: Number(item.finalPrice),
            })),
            createdAt: booking.createdAt,
        };
    }
}
