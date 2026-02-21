import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import { AddAliasDto } from './dto/add-alias.dto';
import { CategoriesService } from './providers/categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /* ==========================================
     CREATE CATEGORY
  ========================================== */

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto.name, dto.parentId);
  }

  /* ==========================================
     GET FULL TREE
  ========================================== */

  @Get('tree')
  getTree() {
    return this.categoriesService.getTree();
  }

  /* ==========================================
     GET SUBTREE
  ========================================== */

  @Get(':id')
  getSubTree(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.getSubTree(id);
  }

  /* ==========================================
     UPDATE CATEGORY
  ========================================== */

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto.name);
  }

  /* ==========================================
     MOVE CATEGORY
  ========================================== */

  @Patch(':id/move')
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.categoriesService.moveCategory(id, dto.newParentId);
  }

  /* ==========================================
     DELETE CATEGORY
  ========================================== */

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.delete(id);
  }

  /* ==========================================
     ADD ALIAS
  ========================================== */

  @Post(':id/alias')
  addAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAliasDto,
  ) {
    return this.categoriesService.addAlias(id, dto.alias);
  }

  /* ==========================================
     FIND BY ALIAS
  ========================================== */

  @Get('alias/:alias')
  findByAlias(@Param('alias') alias: string) {
    return this.categoriesService.findByAlias(alias);
  }

  /* ==========================================
     INCREMENT USAGE
     (Internal or Event Hook)
  ========================================== */

  @Patch(':id/usage')
  incrementUsage(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.incrementUsage(id);
  }
}