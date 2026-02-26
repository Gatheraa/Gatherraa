import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { BookingService } from '../services/booking.service';
import { CartService } from '../services/cart.service';
import { SeatService } from '../services/seat.service';
import { PricingService } from '../services/pricing.service';
import {
    AddToCartDto,
    RemoveFromCartDto,
    CreateSeatsDto,
    SeatQueryDto,
    CalculatePriceDto,
    CreateBookingDto,
    ConfirmBookingDto,
    CancelBookingDto,
    ApplyPromoCodeDto,
} from '../dto/booking.dto';

@Controller('booking')
@UseGuards(JwtAuthGuard)
export class BookingController {
    constructor(
        private readonly bookingService: BookingService,
        private readonly cartService: CartService,
        private readonly seatService: SeatService,
        private readonly pricingService: PricingService,
    ) { }

    // ---- Cart Endpoints ----

    @Post('cart')
    async addToCart(@Body() dto: AddToCartDto, @Request() req) {
        const cart = await this.cartService.addToCart(
            req.user.id,
            dto.eventId,
            dto.seatIds,
        );
        const seats = await this.seatService.getSeatsByIds(cart.seatIds);
        const ttl = await this.cartService.getCartTTL(req.user.id, dto.eventId);
        return {
            userId: cart.userId,
            eventId: cart.eventId,
            seatIds: cart.seatIds,
            seats: seats.map((s) => ({
                id: s.id,
                section: s.section,
                row: s.row,
                number: s.number,
                tier: s.tier,
                price: Number(s.price),
            })),
            expiresIn: ttl,
        };
    }

    @Delete('cart')
    async removeFromCart(
        @Body() dto: RemoveFromCartDto,
        @Query('eventId') eventId: string,
        @Request() req,
    ) {
        const cart = await this.cartService.removeFromCart(
            req.user.id,
            eventId,
            dto.seatIds,
        );
        const seats = cart.seatIds.length > 0
            ? await this.seatService.getSeatsByIds(cart.seatIds)
            : [];
        const ttl = await this.cartService.getCartTTL(req.user.id, eventId);
        return {
            userId: cart.userId,
            eventId: cart.eventId,
            seatIds: cart.seatIds,
            seats: seats.map((s) => ({
                id: s.id,
                section: s.section,
                row: s.row,
                number: s.number,
                tier: s.tier,
                price: Number(s.price),
            })),
            expiresIn: ttl,
        };
    }

    @Get('cart/:eventId')
    async getCart(@Param('eventId') eventId: string, @Request() req) {
        const cart = await this.cartService.getCart(req.user.id, eventId);
        if (!cart || cart.seatIds.length === 0) {
            return {
                userId: req.user.id,
                eventId,
                seatIds: [],
                seats: [],
                expiresIn: 0,
            };
        }
        const seats = await this.seatService.getSeatsByIds(cart.seatIds);
        const ttl = await this.cartService.getCartTTL(req.user.id, eventId);
        return {
            userId: cart.userId,
            eventId: cart.eventId,
            seatIds: cart.seatIds,
            seats: seats.map((s) => ({
                id: s.id,
                section: s.section,
                row: s.row,
                number: s.number,
                tier: s.tier,
                price: Number(s.price),
            })),
            expiresIn: ttl,
        };
    }

    @Delete('cart/:eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async clearCart(@Param('eventId') eventId: string, @Request() req) {
        await this.cartService.clearCart(req.user.id, eventId);
    }

    // ---- Seat Endpoints ----

    @Post('seats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
    async createSeats(@Body() dto: CreateSeatsDto) {
        return this.seatService.createSeats(dto);
    }

    @Get('seats')
    async getSeats(@Query() query: SeatQueryDto) {
        return this.seatService.getSeats(query);
    }

    @Get('seats/availability/:eventId')
    async getSeatAvailability(@Param('eventId') eventId: string) {
        return this.seatService.getAvailability(eventId);
    }

    @Post('seats/unavailable')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
    async markSeatsUnavailable(@Body('seatIds') seatIds: string[]) {
        await this.seatService.markUnavailable(seatIds);
        return { message: 'Seats marked as unavailable' };
    }

    @Post('seats/available')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
    async markSeatsAvailable(@Body('seatIds') seatIds: string[]) {
        await this.seatService.markAvailable(seatIds);
        return { message: 'Seats marked as available' };
    }

    // ---- Pricing Endpoint ----

    @Post('price')
    async calculatePrice(@Body() dto: CalculatePriceDto, @Request() req) {
        const seats = await this.seatService.getSeatsByIds(dto.seatIds);
        return this.pricingService.calculatePrice(
            seats,
            req.user.id,
            dto.promoCode,
        );
    }

    // ---- Booking Endpoints ----

    @Post()
    async createBooking(@Body() dto: CreateBookingDto, @Request() req) {
        return this.bookingService.createBooking(dto, req.user.id);
    }

    @Post('confirm')
    async confirmBooking(@Body() dto: ConfirmBookingDto, @Request() req) {
        return this.bookingService.confirmBooking(dto.bookingId, req.user.id);
    }

    @Post('cancel')
    async cancelBooking(@Body() dto: CancelBookingDto, @Request() req) {
        return this.bookingService.cancelBooking(
            dto.bookingId,
            req.user.id,
            dto.reason,
        );
    }

    @Post('promo')
    async applyPromoCode(@Body() dto: ApplyPromoCodeDto, @Request() req) {
        return this.bookingService.applyPromoCode(dto, req.user.id);
    }

    @Get(':id')
    async getBooking(@Param('id') id: string, @Request() req) {
        return this.bookingService.getBooking(id, req.user.id);
    }

    @Get()
    async getUserBookings(@Request() req) {
        return this.bookingService.getUserBookings(req.user.id);
    }
}
