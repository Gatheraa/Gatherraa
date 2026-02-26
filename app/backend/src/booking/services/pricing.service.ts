import { Injectable, BadRequestException } from '@nestjs/common';
import { Seat } from '../entities/booking.entity';
import { CouponService } from '../../coupons/services/coupon.service';
import { PriceCalculationResultDto, PriceBreakdownDto } from '../dto/booking.dto';

@Injectable()
export class PricingService {
    constructor(private readonly couponService: CouponService) { }

    /**
     * Calculate total price for selected seats with optional promo code
     */
    async calculatePrice(
        seats: Seat[],
        userId: string,
        promoCode?: string,
        currency: string = 'USD',
    ): Promise<PriceCalculationResultDto> {
        if (seats.length === 0) {
            throw new BadRequestException('No seats provided for pricing');
        }

        const items: PriceBreakdownDto[] = seats.map((seat) => ({
            seatId: seat.id,
            section: seat.section,
            row: seat.row,
            number: seat.number,
            tier: seat.tier,
            basePrice: Number(seat.price),
            finalPrice: Number(seat.price),
        }));

        const subtotal = items.reduce((sum, item) => sum + item.basePrice, 0);
        let discountAmount = 0;
        let appliedPromoCode: string | null = null;

        // Apply promo code if provided
        if (promoCode) {
            const validation = await this.couponService.validateCoupon({
                code: promoCode,
                userId,
                orderAmount: subtotal,
            });

            if (!validation.isValid) {
                throw new BadRequestException(
                    validation.errorMessage || 'Invalid promo code',
                );
            }

            discountAmount = validation.discountAmount || 0;
            appliedPromoCode = promoCode;

            // Distribute discount proportionally across items
            if (discountAmount > 0 && subtotal > 0) {
                for (const item of items) {
                    const proportion = item.basePrice / subtotal;
                    const itemDiscount = Math.round(proportion * discountAmount * 100) / 100;
                    item.finalPrice = Math.max(0, item.basePrice - itemDiscount);
                }

                // Adjust rounding errors on the last item
                const totalFinal = items.reduce((sum, item) => sum + item.finalPrice, 0);
                const expectedTotal = Math.max(0, subtotal - discountAmount);
                const diff = Math.round((expectedTotal - totalFinal) * 100) / 100;
                if (diff !== 0 && items.length > 0) {
                    items[items.length - 1].finalPrice += diff;
                }
            }
        }

        const total = Math.max(0, subtotal - discountAmount);

        return {
            items,
            subtotal,
            discountAmount,
            total,
            currency,
            promoCode: appliedPromoCode,
        };
    }
}
