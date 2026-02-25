import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import {
    WebhookResponseDto,
    WebhookSecretResponseDto,
} from './dto/webhook-response.dto';
import { TestWebhookDto, WebhookAnalyticsQueryDto } from './dto/webhook-analytics.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new webhook subscription' })
    @ApiResponse({ status: HttpStatus.CREATED, type: WebhookSecretResponseDto })
    create(@GetUser() user: User, @Body() createWebhookDto: CreateWebhookDto) {
        return this.webhooksService.createWebhook(user.id, createWebhookDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all webhook subscriptions' })
    @ApiResponse({ status: HttpStatus.OK, type: [WebhookResponseDto] })
    findAll(
        @GetUser() user: User,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.webhooksService.findAllWebhooks(user.id, page, limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single webhook subscription' })
    @ApiResponse({ status: HttpStatus.OK, type: WebhookResponseDto })
    findOne(@Param('id') id: string, @GetUser() user: User) {
        return this.webhooksService.findOneWebhook(id, user.id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a webhook subscription' })
    @ApiResponse({ status: HttpStatus.OK, type: WebhookResponseDto })
    update(
        @Param('id') id: string,
        @GetUser() user: User,
        @Body() updateWebhookDto: UpdateWebhookDto,
    ) {
        return this.webhooksService.updateWebhook(id, user.id, updateWebhookDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a webhook subscription' })
    @ApiResponse({ status: HttpStatus.NO_CONTENT })
    remove(@Param('id') id: string, @GetUser() user: User) {
        return this.webhooksService.deleteWebhook(id, user.id);
    }

    @Post(':id/rotate-secret')
    @ApiOperation({ summary: 'Rotate the signing secret for a webhook' })
    @ApiResponse({ status: HttpStatus.OK })
    rotateSecret(@Param('id') id: string, @GetUser() user: User) {
        return this.webhooksService.rotateSecret(id, user.id);
    }

    @Post(':id/test')
    @ApiOperation({ summary: 'Trigger a test event to the webhook' })
    @ApiResponse({ status: HttpStatus.OK })
    test(
        @Param('id') id: string,
        @GetUser() user: User,
        @Body() dto: TestWebhookDto,
    ) {
        return this.webhooksService.testWebhook(id, user.id, dto.eventType);
    }

    @Get(':id/deliveries')
    @ApiOperation({ summary: 'Get delivery attempt history for a webhook' })
    @ApiResponse({ status: HttpStatus.OK })
    getDeliveries(
        @Param('id') id: string,
        @GetUser() user: User,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.webhooksService.getDeliveries(user.id, id, page, limit);
    }

    @Get(':id/analytics')
    @ApiOperation({ summary: 'Get delivery analytics for a webhook' })
    @ApiResponse({ status: HttpStatus.OK })
    getAnalytics(
        @Param('id') id: string,
        @GetUser() user: User,
        @Query() query: WebhookAnalyticsQueryDto,
    ) {
        return this.webhooksService.getAnalytics(user.id, id, query);
    }
}
