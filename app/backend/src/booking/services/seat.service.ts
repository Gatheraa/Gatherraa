import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Seat, SeatStatus } from '../entities/booking.entity';
import {
    CreateSeatsDto,
    SeatQueryDto,
    SeatAvailabilityResponseDto,
} from '../dto/booking.dto';

@Injectable()
export class SeatService {
    constructor(
        @InjectRepository(Seat)
        private seatRepository: Repository<Seat>,
        @InjectDataSource()
        private dataSource: DataSource,
    ) { }

    /**
     * Create seats for an event (inventory management)
     */
    async createSeats(dto: CreateSeatsDto): Promise<Seat[]> {
        const seats = dto.seats.map((s) =>
            this.seatRepository.create({
                eventId: dto.eventId,
                section: s.section,
                row: s.row,
                number: s.number,
                price: s.price,
                tier: s.tier || 'general',
                status: SeatStatus.AVAILABLE,
            }),
        );

        return this.seatRepository.save(seats);
    }

    /**
     * Get seats by query filters
     */
    async getSeats(query: SeatQueryDto): Promise<Seat[]> {
        const where: any = { eventId: query.eventId };
        if (query.section) where.section = query.section;
        if (query.status) where.status = query.status;
        if (query.tier) where.tier = query.tier;

        return this.seatRepository.find({ where, order: { section: 'ASC', row: 'ASC', number: 'ASC' } });
    }

    /**
     * Get seat availability summary for an event
     */
    async getAvailability(eventId: string): Promise<SeatAvailabilityResponseDto> {
        const seats = await this.seatRepository.find({ where: { eventId } });

        const total = seats.length;
        const available = seats.filter((s) => s.status === SeatStatus.AVAILABLE).length;
        const reserved = seats.filter((s) => s.status === SeatStatus.RESERVED).length;
        const booked = seats.filter((s) => s.status === SeatStatus.BOOKED).length;

        // Group by section
        const sectionMap = new Map<string, Seat[]>();
        for (const seat of seats) {
            const list = sectionMap.get(seat.section) || [];
            list.push(seat);
            sectionMap.set(seat.section, list);
        }

        const sections = Array.from(sectionMap.entries()).map(([section, sectionSeats]) => {
            // Group by tier within section
            const tierMap = new Map<string, Seat[]>();
            for (const seat of sectionSeats) {
                const list = tierMap.get(seat.tier) || [];
                list.push(seat);
                tierMap.set(seat.tier, list);
            }

            const tiers = Array.from(tierMap.entries()).map(([tier, tierSeats]) => {
                const prices = tierSeats.map((s) => Number(s.price));
                return {
                    tier,
                    total: tierSeats.length,
                    available: tierSeats.filter((s) => s.status === SeatStatus.AVAILABLE).length,
                    minPrice: Math.min(...prices),
                    maxPrice: Math.max(...prices),
                };
            });

            return {
                section,
                total: sectionSeats.length,
                available: sectionSeats.filter((s) => s.status === SeatStatus.AVAILABLE).length,
                tiers,
            };
        });

        return { eventId, total, available, reserved, booked, sections };
    }

    /**
     * Reserve seats with optimistic locking.
     * Returns the reserved seats or throws on conflict.
     */
    async reserveSeats(
        seatIds: string[],
        userId: string,
        reservationMinutes: number = 15,
    ): Promise<Seat[]> {
        return this.dataSource.transaction(async (manager) => {
            const seats = await manager.find(Seat, {
                where: { id: In(seatIds) },
            });

            if (seats.length !== seatIds.length) {
                throw new NotFoundException('One or more seats not found');
            }

            const unavailable = seats.filter((s) => s.status !== SeatStatus.AVAILABLE);
            if (unavailable.length > 0) {
                throw new ConflictException(
                    `Seats not available: ${unavailable.map((s) => `${s.section}-${s.row}-${s.number}`).join(', ')}`,
                );
            }

            const reservedUntil = new Date(Date.now() + reservationMinutes * 60 * 1000);

            // Optimistic locking: update only if version matches
            for (const seat of seats) {
                const result = await manager
                    .createQueryBuilder()
                    .update(Seat)
                    .set({
                        status: SeatStatus.RESERVED,
                        reservedBy: userId,
                        reservedUntil,
                    })
                    .where('id = :id AND version = :version', {
                        id: seat.id,
                        version: seat.version,
                    })
                    .execute();

                if (result.affected === 0) {
                    throw new ConflictException(
                        `Seat ${seat.section}-${seat.row}-${seat.number} was modified by another request`,
                    );
                }
            }

            return manager.find(Seat, { where: { id: In(seatIds) } });
        });
    }

    /**
     * Release reserved seats back to available
     */
    async releaseSeats(seatIds: string[]): Promise<void> {
        await this.seatRepository
            .createQueryBuilder()
            .update(Seat)
            .set({
                status: SeatStatus.AVAILABLE,
                reservedBy: null,
                reservedUntil: null,
            })
            .where('id IN (:...ids)', { ids: seatIds })
            .andWhere('status = :status', { status: SeatStatus.RESERVED })
            .execute();
    }

    /**
     * Mark reserved seats as booked (after confirmation)
     */
    async confirmSeats(seatIds: string[]): Promise<void> {
        await this.seatRepository
            .createQueryBuilder()
            .update(Seat)
            .set({
                status: SeatStatus.BOOKED,
                reservedUntil: null,
            })
            .where('id IN (:...ids)', { ids: seatIds })
            .andWhere('status = :status', { status: SeatStatus.RESERVED })
            .execute();
    }

    /**
     * Expire reservations that have passed their reservedUntil time.
     * Called by the scheduled task in BookingService.
     */
    async expireReservations(): Promise<string[]> {
        const now = new Date();
        const expired = await this.seatRepository
            .createQueryBuilder('seat')
            .select('seat.id')
            .where('seat.status = :status', { status: SeatStatus.RESERVED })
            .andWhere('seat.reservedUntil <= :now', { now })
            .getMany();

        if (expired.length === 0) return [];

        const expiredIds = expired.map((s) => s.id);
        await this.releaseSeats(expiredIds);
        return expiredIds;
    }

    /**
     * Get seats by IDs
     */
    async getSeatsByIds(seatIds: string[]): Promise<Seat[]> {
        return this.seatRepository.find({ where: { id: In(seatIds) } });
    }

    /**
     * Update seat status to unavailable (inventory management)
     */
    async markUnavailable(seatIds: string[]): Promise<void> {
        await this.seatRepository
            .createQueryBuilder()
            .update(Seat)
            .set({ status: SeatStatus.UNAVAILABLE })
            .where('id IN (:...ids)', { ids: seatIds })
            .andWhere('status = :status', { status: SeatStatus.AVAILABLE })
            .execute();
    }

    /**
     * Mark unavailable seats as available (inventory management)
     */
    async markAvailable(seatIds: string[]): Promise<void> {
        await this.seatRepository
            .createQueryBuilder()
            .update(Seat)
            .set({ status: SeatStatus.AVAILABLE })
            .where('id IN (:...ids)', { ids: seatIds })
            .andWhere('status = :status', { status: SeatStatus.UNAVAILABLE })
            .execute();
    }
}
