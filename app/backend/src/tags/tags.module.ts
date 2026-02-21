import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { TagUsage } from './entities/tag-usage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, TagUsage])],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
