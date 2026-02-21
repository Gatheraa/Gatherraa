import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User, ProfileVisibility } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSocialLinksDto } from './dto/update-social-links.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /* ======================================================
      CREATE
  ====================================================== */

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    user.profileCompletion = this.calculateCompletion(user);
    return this.usersRepository.save(user);
  }

  /* ======================================================
      FIND PRIVATE (Owner)
  ====================================================== */

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Alias for findById for backward compatibility
  async findOneById(id: string): Promise<User> {
    return this.findById(id);
  }

  /* ======================================================
      FIND PUBLIC (Privacy Enforced)
  ====================================================== */

  async findPublicProfile(id: string): Promise<Partial<User>> {
    const user = await this.findById(id);

    if (user.profileVisibility === ProfileVisibility.PRIVATE) {
      throw new ForbiddenException('Profile is private');
    }

    const { email, preferences, ...publicProfile } = user;
    return publicProfile;
  }

  /* ======================================================
      UPDATE
  ====================================================== */

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, dto);

    user.profileCompletion = this.calculateCompletion(user);

    return this.usersRepository.save(user);
  }

  /* ======================================================
      DELETE
  ====================================================== */

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
  }

  /* ======================================================
      UPDATE PREFERENCES
  ====================================================== */

  async updatePreferences(
    id: string,
    dto: UpdatePreferencesDto,
  ): Promise<User> {
    const user = await this.findById(id);

    user.preferences = {
      ...user.preferences,
      ...dto.preferences,
    };

    return this.usersRepository.save(user);
  }

  /* ======================================================
      UPDATE SOCIAL LINKS
  ====================================================== */

  async updateSocialLinks(
    id: string,
    dto: UpdateSocialLinksDto,
  ): Promise<User> {
    const user = await this.findById(id);

    user.socialLinks = {
      ...user.socialLinks,
      ...dto,
    };

    user.profileCompletion = this.calculateCompletion(user);

    return this.usersRepository.save(user);
  }

  /* ======================================================
      UPDATE AVATAR
  ====================================================== */

  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(id);

    user.avatarUrl = avatarUrl;
    user.profileCompletion = this.calculateCompletion(user);

    return this.usersRepository.save(user);
  }

  /* ======================================================
      SEARCH (Performant)
  ====================================================== */

  async search(query: string): Promise<User[]> {
    return this.usersRepository.find({
      where: [
        { firstName: ILike(`%${query}%`) },
        { lastName: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) },
      ],
      take: 20,
    });
  }

  /* ======================================================
      GDPR EXPORT
  ====================================================== */

  async exportProfile(id: string): Promise<Record<string, any>> {
    const user = await this.findById(id);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      profileVisibility: user.profileVisibility,
      preferences: user.preferences,
      socialLinks: user.socialLinks,
      profileCompletion: user.profileCompletion,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /* ======================================================
      PROFILE COMPLETION LOGIC
  ====================================================== */

  private calculateCompletion(user: Partial<User>): number {
    const fields = [
      user.firstName,
      user.lastName,
      user.bio,
      user.avatarUrl,
      user.socialLinks && Object.keys(user.socialLinks).length > 0,
      user.preferences && Object.keys(user.preferences).length > 0,
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  }

  /* ======================================================
      WALLET AUTH METHODS
  ====================================================== */

  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const user = await this.usersRepository.findOne({
      where: { walletAddress },
    });

    if (user) {
      user.nonce = nonce;
      await this.usersRepository.save(user);
    }

    return nonce;
  }

  async validateNonce(walletAddress: string, nonce: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { walletAddress },
    });

    if (!user || user.nonce !== nonce) {
      return false;
    }

    // Clear nonce after validation
    user.nonce = null;
    await this.usersRepository.save(user);

    return true;
  }

  async findOneByWallet(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { walletAddress },
    });
  }

  async linkWallet(userId: string, walletAddress: string): Promise<User> {
    const user = await this.findById(userId);

    if (!user.linkedWallets) {
      user.linkedWallets = [];
    }

    if (!user.linkedWallets.includes(walletAddress)) {
      user.linkedWallets.push(walletAddress);
    }

    return this.usersRepository.save(user);
  }

  async createFromWallet(walletAddress: string): Promise<User> {
    // Create a new user with just a wallet address
    const user = this.usersRepository.create({
      walletAddress,
      firstName: 'User',
      lastName: walletAddress.substring(0, 6),
      email: `${walletAddress}@wallet.local`,
      profileVisibility: ProfileVisibility.PUBLIC,
    });

    user.profileCompletion = this.calculateCompletion(user);
    return this.usersRepository.save(user);
  }
}
