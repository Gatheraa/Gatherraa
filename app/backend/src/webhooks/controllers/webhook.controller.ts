import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { CurrentUser } from 'src/auth/decorators/user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'; // Assuming this exists based on typical NestJS setups

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  create(@Body() createDto: CreateWebhookDto, @CurrentUser() user: any) {
    return this.webhookService.create(createDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.webhookService.findAll(user.id);
  }

  @Get('analytics')
  getAnalytics(@CurrentUser() user: any) {
    return this.webhookService.getAnalytics(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.webhookService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateWebhookDto,
    @CurrentUser() user: any,
  ) {
    return this.webhookService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.webhookService.remove(id, user.id);
  }

  @Post(':id/ping')
  ping(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.webhookService.ping(id, user.id);
  }

  @Get(':id/deliveries')
  getDeliveries(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    return this.webhookService.getDeliveries(id, user.id, limit);
  }
}
