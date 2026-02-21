import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { MergeTagDto } from './dto/merge-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /* CREATE */
  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto.name);
  }

  /* GET ALL */
  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  /* SUGGEST */
  @Get('suggest')
  suggest(@Query('q') query: string) {
    return this.tagsService.suggest(query);
  }

  /* TRENDING */
  @Get('trending')
  trending() {
    return this.tagsService.getTrending();
  }

  /* TRACK USAGE */
  @Post(':id/usage/:eventId')
  trackUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId') eventId: string,
  ) {
    return this.tagsService.trackUsage(id, eventId);
  }

  /* MERGE */
  @Patch(':id/merge')
  merge(
    @Param('id', ParseUUIDPipe) sourceId: string,
    @Body() dto: MergeTagDto,
  ) {
    return this.tagsService.merge(sourceId, dto.targetTagId);
  }

  /* ANALYTICS */
  @Get('analytics/usage')
  analytics() {
    return this.tagsService.getUsageAnalytics();
  }
}