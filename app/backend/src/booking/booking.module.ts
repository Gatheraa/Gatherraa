import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Booking, BookingItem, Seat } from './entities/booking.entity';
import { BookingService } from './services/booking.service';
import { CartService } from './services/cart.service';
import { SeatService } from './services/seat.service';
import { PricingService } from './services/pricing.service';
import { BookingController } from './controllers/booking.controller';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Booking, BookingItem, Seat]),
        ConfigModule,
        CouponsModule,
    ],
    controllers: [BookingController],
    providers: [BookingService, CartService, SeatService, PricingService],
    exports: [BookingService, SeatService],
})
export class BookingModule { }
