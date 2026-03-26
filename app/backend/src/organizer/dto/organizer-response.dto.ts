import { IsString, IsNumber, IsOptional, IsDate, IsArray } from 'class-validator';

export class EventStatsDto {
  @IsNumber()
  totalTickets: number;

  @IsNumber()
  ticketsSold: number;

  @IsNumber()
  attendanceRate: number;

  @IsNumber()
  totalRevenue: number;

  @IsNumber()
  checkedInCount: number;

  @IsNumber()
  remainingCount: number;
}

export class AttendeeDto {
  @IsString()
  bookingItemId: string;

  @IsString()
  userId: string;

  @IsString()
  userName: string;

  @IsString()
  userEmail: string;

  @IsString()
  @IsOptional()
  seatNumber?: string;

  @IsString()
  @IsOptional()
  seatSection?: string;

  @IsString()
  status: string;

  @IsDate()
  @IsOptional()
  checkedInAt?: Date | null;

  @IsDate()
  @IsOptional()
  checkedOutAt?: Date | null;
}

export class RevenueReportDto {
  @IsNumber()
  totalRevenue: number;

  @IsNumber()
  netRevenue: number;

  @IsNumber()
  fees: number;

  @IsArray()
  revenueByDay: { date: string; amount: number }[];
}

export class SalesAnalyticsDto {
  @IsNumber()
  totalSales: number;

  @IsArray()
  salesTrends: { date: string; count: number }[];
}

export class MessageAttendeesDto {
  @IsString()
  subject: string;

  @IsString()
  content: string;
}
