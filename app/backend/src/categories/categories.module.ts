import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './providers/categories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryAlias } from './entities/category-alias.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category,CategoryAlias])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
