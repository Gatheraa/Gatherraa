import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSocialLinksDto } from './dto/update-social-links.dto';
import { avatarUploadOptions } from './avatar-upload.config';
import { S3Service } from '../storage/s3.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  /* ================= CREATE ================= */

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /* ================= PRIVATE PROFILE ================= */

  @Get('me')
  getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  /* ================= PUBLIC PROFILE ================= */

  @Get(':id/public')
  getPublic(@Param('id') id: string) {
    return this.usersService.findPublicProfile(id);
  }

  /* ================= UPDATE ================= */

  @Patch('me')
  update(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  /* ================= DELETE ================= */

  @Delete('me')
  remove(@Req() req: any) {
    return this.usersService.remove(req.user.id);
  }

  /* ================= AVATAR UPLOAD ================= */

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const avatarUrl = await this.s3Service.uploadFile(file);
    return this.usersService.updateAvatar(req.user.id, avatarUrl);
  }

  /* ================= PREFERENCES ================= */

  @Patch('me/preferences')
  updatePreferences(
    @Req() req: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(req.user.id, dto);
  }

  /* ================= SOCIAL LINKS ================= */

  @Patch('me/social-links')
  updateSocial(
    @Req() req: any,
    @Body() dto: UpdateSocialLinksDto,
  ) {
    return this.usersService.updateSocialLinks(req.user.id, dto);
  }

  /* ================= SEARCH ================= */

  @Get()
  search(@Query('q') query: string) {
    return this.usersService.search(query);
  }

  /* ================= GDPR EXPORT ================= */

  @Get('me/export')
  export(@Req() req: any) {
    return this.usersService.exportProfile(req.user.id);
  }
}