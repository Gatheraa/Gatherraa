import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  TreeRepository,
  Repository,
  DataSource,
} from 'typeorm';
import { Category } from '../entities/category.entity';
import { CategoryAlias } from '../entities/category-alias.entity';


@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: TreeRepository<Category>,

    @InjectRepository(CategoryAlias)
    private readonly aliasRepo: Repository<CategoryAlias>,

    private readonly dataSource: DataSource,
  ) {}

  /* ==========================================
     CREATE CATEGORY
  ========================================== */

  async create(name: string, parentId?: string): Promise<Category> {
    const existing = await this.categoryRepo.findOne({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Category already exists');
    }

    const category = new Category();
    category.name = name;

    if (parentId) {
      const parent = await this.categoryRepo.findOne({
        where: { id: parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      category.parent = parent;
    }

    return this.categoryRepo.save(category);
  }

  /* ==========================================
     GET FULL TREE
  ========================================== */

  async getTree(): Promise<Category[]> {
    return this.categoryRepo.findTrees();
  }

  /* ==========================================
     GET SUBTREE
  ========================================== */

  async getSubTree(id: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.categoryRepo.findDescendantsTree(category);
  }

  /* ==========================================
     UPDATE CATEGORY
  ========================================== */

  async update(id: string, name: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.name = name;
    return this.categoryRepo.save(category);
  }

  /* ==========================================
     MOVE CATEGORY (Change Parent)
  ========================================== */

  async moveCategory(id: string, newParentId: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const newParent = await this.categoryRepo.findOne({
      where: { id: newParentId },
    });

    if (!newParent) {
      throw new NotFoundException('New parent not found');
    }

    // Prevent moving under itself
    if (id === newParentId) {
      throw new BadRequestException('Cannot move under itself');
    }

    // Prevent circular hierarchy
    const descendants =
      await this.categoryRepo.findDescendants(category);

    if (descendants.some((d) => d.id === newParentId)) {
      throw new BadRequestException(
        'Cannot move category into its own descendant',
      );
    }

    category.parent = newParent;
    return this.categoryRepo.save(category);
  }

  /* ==========================================
     DELETE CATEGORY
  ========================================== */

  async delete(id: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryRepo.remove(category);
  }

  /* ==========================================
     ALIAS MANAGEMENT
  ========================================== */

  async addAlias(categoryId: string, alias: string) {
    const category = await this.categoryRepo.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const existingAlias = await this.aliasRepo.findOne({
      where: { alias },
    });

    if (existingAlias) {
      throw new BadRequestException('Alias already exists');
    }

    const newAlias = this.aliasRepo.create({
      alias,
      category,
    });

    return this.aliasRepo.save(newAlias);
  }

  async findByAlias(alias: string): Promise<Category> {
    const aliasEntity = await this.aliasRepo.findOne({
      where: { alias },
      relations: ['category'],
    });

    if (!aliasEntity) {
      throw new NotFoundException('Alias not found');
    }

    return aliasEntity.category;
  }

  /* ==========================================
     USAGE COUNT
  ========================================== */

  async incrementUsage(id: string) {
    await this.categoryRepo.increment(
      { id },
      'usageCount',
      1,
    );
  }
}