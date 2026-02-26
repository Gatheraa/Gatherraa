import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto, EvaluateFlagDto, BulkEvaluateFlagsDto } from './dto/create-feature-flag.dto';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  create(@Body() createDto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(createDto);
  }

  @Get()
  findAll(@Query('environment') environment?: string) {
    return this.featureFlagsService.findAll(environment);
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.featureFlagsService.findByKey(key);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() updateDto: UpdateFeatureFlagDto) {
    return this.featureFlagsService.update(key, updateDto);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('key') key: string) {
    return this.featureFlagsService.remove(key);
  }

  @Post('evaluate')
  evaluate(@Body() evaluateDto: EvaluateFlagDto) {
    return this.featureFlagsService.evaluateFlag(evaluateDto);
  }

  @Post('bulk-evaluate')
  bulkEvaluate(@Body() bulkDto: BulkEvaluateFlagsDto) {
    return this.featureFlagsService.bulkEvaluate(bulkDto);
  }

  @Post(':key/toggle')
  toggleStatus(@Param('key') key: string) {
    return this.featureFlagsService.toggleStatus(key);
  }

  @Post(':key/kill-switch')
  killSwitch(@Param('key') key: string, @Body('reason') reason?: string) {
    return this.featureFlagsService.killSwitch(key, reason);
  }

  @Get(':key/analytics')
  getAnalytics(
    @Param('key') key: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.featureFlagsService.getAnalytics(key, start, end);
  }

  @Post(':key/whitelist/:userId')
  addToWhitelist(@Param('key') key: string, @Param('userId') userId: string) {
    return this.featureFlagsService.addToWhitelist(key, userId);
  }

  @Delete(':key/whitelist/:userId')
  removeFromWhitelist(@Param('key') key: string, @Param('userId') userId: string) {
    return this.featureFlagsService.removeFromWhitelist(key, userId);
  }

  @Get('cache/stats')
  getCacheStats() {
    return this.featureFlagsService.getCacheStats();
  }
}
