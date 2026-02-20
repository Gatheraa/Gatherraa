import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, OAuthProvider } from './entities/user.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(walletAddress: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { walletAddress },
    });

    if (existingUser) {
      throw new ConflictException('User with this wallet address already exists');
    }

    const user = this.usersRepository.create({
      walletAddress,
      roles: [UserRole.ATTENDEE],
      linkedWallets: [],
      oauthProviders: [],
    });

    return this.usersRepository.save(user);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneByWallet(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { walletAddress } });
  }

  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    
    const user = await this.findOneByWallet(walletAddress);
    if (user) {
      user.nonce = nonce;
      await this.usersRepository.save(user);
    } else {
      // Create user with nonce if doesn't exist
      await this.create(walletAddress);
      const newUser = await this.findOneByWallet(walletAddress);
      if (newUser) {
        newUser.nonce = nonce;
        await this.usersRepository.save(newUser);
      }
    }
    
    return nonce;
  }

  async validateNonce(walletAddress: string, nonce: string): Promise<boolean> {
    const user = await this.findOneByWallet(walletAddress);
    if (!user || !user.nonce) {
      return false;
    }
    
    const isValid = user.nonce === nonce;
    if (isValid) {
      // Clear nonce after successful validation
      user.nonce = null;
      user.lastLoginAt = new Date();
      await this.usersRepository.save(user);
    }
    
    return isValid;
  }

  async linkWallet(userId: string, walletAddress: string): Promise<User> {
    const user = await this.findOneById(userId);
    
    // Check if wallet is already linked to another user
    const existingUser = await this.findOneByWallet(walletAddress);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Wallet address already linked to another user');
    }
    
    // Add to linked wallets if not already present
    if (!user.linkedWallets.includes(walletAddress)) {
      user.linkedWallets.push(walletAddress);
      return this.usersRepository.save(user);
    }
    
    return user;
  }

  async addOAuthProvider(
    userId: string,
    providerData: OAuthProvider,
  ): Promise<User> {
    const user = await this.findOneById(userId);
    
    if (!user.oauthProviders) {
      user.oauthProviders = [];
    }
    
    // Check if provider already exists
    const existingProviderIndex = user.oauthProviders.findIndex(
      p => p.provider === providerData.provider,
    );
    
    if (existingProviderIndex >= 0) {
      user.oauthProviders[existingProviderIndex] = providerData;
    } else {
      user.oauthProviders.push(providerData);
    }
    
    return this.usersRepository.save(user);
  }

  async updateProfile(
    userId: string,
    updateData: Partial<Pick<User, 'username' | 'email' | 'avatar'>>,
  ): Promise<User> {
    const user = await this.findOneById(userId);
    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async assignRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findOneById(userId);
    
    if (!user.roles.includes(role)) {
      user.roles.push(role);
      return this.usersRepository.save(user);
    }
    
    return user;
  }

  async removeRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findOneById(userId);
    
    const roleIndex = user.roles.indexOf(role);
    if (roleIndex >= 0) {
      user.roles.splice(roleIndex, 1);
      return this.usersRepository.save(user);
    }
    
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}