import { Controller, Get, Post, Patch, Param, Body, Query, Res, UseGuards } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import { EventStatsDto, AttendeeDto, RevenueReportDto, SalesAnalyticsDto, MessageAttendeesDto } from './dto/organizer-response.dto';
import { Response } from 'express';
// import { AuthGuard } from '../auth/guards/auth.guard'; // Assume auth is needed

@Controller('organizer')
// @UseGuards(AuthGuard)
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Get('events/:eventId/stats')
  async getEventStats(@Param('eventId') eventId: string): Promise<EventStatsDto> {
    return await this.organizerService.getEventStats(eventId);
  }

  @Get('events/:eventId/attendees')
  async getAttendees(
    @Param('eventId') eventId: string,
    @Query('search') search?: string,
  ): Promise<AttendeeDto[]> {
    return await this.organizerService.getAttendees(eventId, search);
  }

  @Patch('bookings/:bookingItemId/check-in')
  async checkIn(@Param('bookingItemId') bookingItemId: string) {
    return await this.organizerService.checkIn(bookingItemId);
  }

  @Patch('bookings/:bookingItemId/check-out')
  async checkOut(@Param('bookingItemId') bookingItemId: string) {
    return await this.organizerService.checkOut(bookingItemId);
  }

  @Get('events/:eventId/revenue')
  async getRevenueReport(@Param('eventId') eventId: string): Promise<RevenueReportDto> {
    return await this.organizerService.getRevenueReport(eventId);
  }

  @Get('events/:eventId/sales-analytics')
  async getSalesAnalytics(@Param('eventId') eventId: string): Promise<SalesAnalyticsDto> {
    return await this.organizerService.getSalesAnalytics(eventId);
  }

  @Post('events/:eventId/message')
  async messageAttendees(
    @Param('eventId') eventId: string,
    @Body() messageDto: MessageAttendeesDto,
  ) {
    return await this.organizerService.messageAttendees(eventId, messageDto);
  }

  @Get('events/:eventId/export')
  async exportAttendees(
    @Param('eventId') eventId: string,
    @Res() res: Response,
  ) {
    const csv = await this.organizerService.exportAttendees(eventId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendees-${eventId}.csv`);
    res.status(200).send(csv);
  }
}
