import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { TagUsage } from './entities/tag-usage.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,

    @InjectRepository(TagUsage)
    private readonly usageRepo: Repository<TagUsage>,

    private readonly dataSource: DataSource,
  ) {}

  /* ==========================================
     CREATE TAG
  ========================================== */

  async create(name: string): Promise<Tag> {
    const existing = await this.tagRepo.findOne({ where: { name } });
    if (existing) {
      throw new BadRequestException('Tag already exists');
    }

    const tag = this.tagRepo.create({ name });
    return this.tagRepo.save(tag);
  }

  /* ==========================================
     GET ALL
  ========================================== */

  async findAll(): Promise<Tag[]> {
    return this.tagRepo.find({
      where: { isMerged: false },
      order: { usageCount: 'DESC' },
    });
  }

  /* ==========================================
     AUTO-SUGGESTIONS (FULL TEXT)
  ========================================== */

  async suggest(query: string): Promise<Tag[]> {
    return this.tagRepo
      .createQueryBuilder('tag')
      .where(
        `to_tsvector('english', tag.name) @@ plainto_tsquery('english', :query)`,
        { query },
      )
      .andWhere('tag.isMerged = false')
      .orderBy('tag.usageCount', 'DESC')
      .limit(10)
      .getMany();
  }

  /* ==========================================
     TRACK USAGE
  ========================================== */

  async trackUsage(tagId: string, eventId: string) {
    const tag = await this.tagRepo.findOne({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');

    await this.usageRepo.save(
      this.usageRepo.create({
        tag,
        eventId,
      }),
    );

    await this.tagRepo.increment({ id: tagId }, 'usageCount', 1);
  }

  /* ==========================================
     TRENDING TAGS (LAST 7 DAYS)
  ========================================== */

  async getTrending(): Promise<any[]> {
    return this.usageRepo
      .createQueryBuilder('usage')
      .leftJoin('usage.tag', 'tag')
      .where(`usage.createdAt > NOW() - INTERVAL '7 days'`)
      .andWhere('tag.isMerged = false')
      .select('tag.id', 'id')
      .addSelect('tag.name', 'name')
      .addSelect('COUNT(usage.id)', 'recentUsage')
      .groupBy('tag.id')
      .orderBy('recentUsage', 'DESC')
      .limit(10)
      .getRawMany();
  }

  /* ==========================================
     MERGE TAGS (TRANSACTIONAL)
  ========================================== */

  async merge(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException('Cannot merge same tag');
    }

    return this.dataSource.transaction(async (manager) => {
      const source = await manager.findOne(Tag, {
        where: { id: sourceId },
      });
      const target = await manager.findOne(Tag, {
        where: { id: targetId },
      });

      if (!source || !target) {
        throw new NotFoundException('Tag not found');
      }

      // Move all usage records
      await manager
        .createQueryBuilder()
        .update(TagUsage)
        .set({ tag: target })
        .where('tagId = :sourceId', { sourceId })
        .execute();

      // Update usage count
      target.usageCount += source.usageCount;

      // Mark source as merged
      source.isMerged = true;
      source.mergedInto = target.id;

      await manager.save(target);
      await manager.save(source);

      return { message: 'Tags merged successfully' };
    });
  }

  /* ==========================================
     ANALYTICS
  ========================================== */

  async getUsageAnalytics() {
    return this.usageRepo
      .createQueryBuilder('usage')
      .leftJoin('usage.tag', 'tag')
      .select('tag.name', 'tag')
      .addSelect("DATE_TRUNC('day', usage.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tag.name')
      .addGroupBy("DATE_TRUNC('day', usage.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();
  }
}