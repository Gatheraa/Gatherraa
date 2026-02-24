import {
    IsString,
    IsUUID,
    IsNumber,
    IsOptional,
    IsArray,
    IsEnum,
    Min,
    Length,
    ValidateNested,
    IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatStatus } from '../entities/booking.entity';

// ---- Cart DTOs ----

export class AddToCartDto {
    @IsUUID()
    eventId: string;

    @IsArray()
    @IsUUID('4', { each: true })
    seatIds: string[];
}

export class RemoveFromCartDto {
    @IsArray()
    @IsUUID('4', { each: true })
    seatIds: string[];
}

// ---- Seat DTOs ----

export class CreateSeatsDto {
    @IsUUID()
    eventId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SeatDefinitionDto)
    seats: SeatDefinitionDto[];
}

export class SeatDefinitionDto {
    @IsString()
    @Length(1, 100)
    section: string;

    @IsString()
    @Length(1, 50)
    row: string;

    @IsString()
    @Length(1, 50)
    number: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsOptional()
    @IsString()
    @Length(1, 50)
    tier?: string;
}

export class SeatQueryDto {
    @IsUUID()
    eventId: string;

    @IsOptional()
    @IsString()
    section?: string;

    @IsOptional()
    @IsEnum(SeatStatus)
    status?: SeatStatus;

    @IsOptional()
    @IsString()
    tier?: string;
}

// ---- Pricing DTOs ----

export class CalculatePriceDto {
    @IsUUID()
    eventId: string;

    @IsArray()
    @IsUUID('4', { each: true })
    seatIds: string[];

    @IsOptional()
    @IsString()
    promoCode?: string;
}

export class PriceBreakdownDto {
    seatId: string;
    section: string;
    row: string;
    number: string;
    tier: string;
    basePrice: number;
    finalPrice: number;
}

export class PriceCalculationResultDto {
    items: PriceBreakdownDto[];
    subtotal: number;
    discountAmount: number;
    total: number;
    currency: string;
    promoCode: string | null;
}

// ---- Booking DTOs ----

export class CreateBookingDto {
    @IsUUID()
    eventId: string;

    @IsArray()
    @IsUUID('4', { each: true })
    seatIds: string[];

    @IsOptional()
    @IsString()
    promoCode?: string;

    @IsOptional()
    @IsString()
    currency?: string;
}

export class ConfirmBookingDto {
    @IsUUID()
    bookingId: string;
}

export class CancelBookingDto {
    @IsUUID()
    bookingId: string;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class ApplyPromoCodeDto {
    @IsUUID()
    bookingId: string;

    @IsString()
    @Length(1, 50)
    promoCode: string;
}

// ---- Response DTOs ----

export class CartResponseDto {
    userId: string;
    eventId: string;
    seatIds: string[];
    seats: CartSeatDto[];
    expiresIn: number;
}

export class CartSeatDto {
    id: string;
    section: string;
    row: string;
    number: string;
    tier: string;
    price: number;
}

export class BookingResponseDto {
    id: string;
    userId: string;
    eventId: string;
    status: string;
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    currency: string;
    promoCode: string | null;
    reservationExpiresAt: Date | null;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    cancellationReason: string | null;
    items: BookingItemResponseDto[];
    createdAt: Date;
}

export class BookingItemResponseDto {
    id: string;
    seatId: string;
    unitPrice: number;
    finalPrice: number;
}

export class SeatAvailabilityResponseDto {
    eventId: string;
    total: number;
    available: number;
    reserved: number;
    booked: number;
    sections: SectionAvailabilityDto[];
}

export class SectionAvailabilityDto {
    section: string;
    total: number;
    available: number;
    tiers: TierAvailabilityDto[];
}

export class TierAvailabilityDto {
    tier: string;
    total: number;
    available: number;
    minPrice: number;
    maxPrice: number;
}
