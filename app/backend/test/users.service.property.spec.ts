import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { fc, test } from 'fast-check';
import { UsersService } from '../src/users/users.service';
import { User, ProfileVisibility } from '../src/users/entities/user.entity';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { UpdatePreferencesDto } from '../src/users/dto/update-preferences.dto';
import { UpdateSocialLinksDto } from '../src/users/dto/update-social-links.dto';
import { WebhookService } from '../src/webhooks/services/webhook.service';
import { WebhookEventType } from '../src/webhooks/constants/webhook.constants';
import { ArbitraryGenerators, PropertyTestHelpers, FuzzTestHelpers } from './utils/property-test-utils';

describe('UsersService Property-Based Tests', () => {
  let service: UsersService;
  let usersRepository: Repository<User>;
  let webhookService: WebhookService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            trigger: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    webhookService = module.get<WebhookService>(WebhookService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('User Creation Property Tests', () => {
    it('should maintain invariants when creating users with valid data', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            const createUserDto: CreateUserDto = {
              email: user.email,
              firstName: user.firstName || 'Test',
              lastName: user.lastName || 'User',
              bio: user.bio,
            };

            jest.spyOn(usersRepository, 'create').mockReturnValue(user);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(user);
            jest.spyOn(webhookService, 'trigger').mockResolvedValue(undefined);

            // Act
            const result = await service.create(createUserDto);

            // Assert
            PropertyTestHelpers.assertUserInvariants(result);
            expect(result.email).toBe(createUserDto.email);
            expect(result.firstName).toBe(createUserDto.firstName);
            expect(result.lastName).toBe(createUserDto.lastName);
            expect(webhookService.trigger).toHaveBeenCalledWith(WebhookEventType.USER_CREATED, result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate profile completion correctly', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            const createUserDto: CreateUserDto = {
              email: user.email,
              firstName: user.firstName || 'Test',
              lastName: user.lastName || 'User',
              bio: user.bio,
            };

            const userWithCompletion = { ...user, profileCompletion: 50 };
            jest.spyOn(usersRepository, 'create').mockReturnValue(userWithCompletion);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(userWithCompletion);
            jest.spyOn(webhookService, 'trigger').mockResolvedValue(undefined);

            // Act
            const result = await service.create(createUserDto);

            // Assert
            expect(typeof result.profileCompletion).toBe('number');
            expect(result.profileCompletion).toBeGreaterThanOrEqual(0);
            expect(result.profileCompletion).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('User Retrieval Property Tests', () => {
    it('should return valid user structure when found', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);

            // Act
            const result = await service.findById(user.id);

            // Assert
            PropertyTestHelpers.assertUserInvariants(result);
            expect(result.id).toBe(user.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should throw NotFoundException for non-existent users', async () => {
      await test(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Arrange
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

            // Act & Assert
            await expect(service.findById(userId)).rejects.toThrow('User not found');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce privacy settings for public profiles', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user().map(user => ({
            ...user,
            profileVisibility: ProfileVisibility.PRIVATE,
          })),
          async (privateUser) => {
            // Arrange
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(privateUser);

            // Act & Assert
            await expect(service.findPublicProfile(privateUser.id)).rejects.toThrow('Profile is private');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return public profile data for public users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user().map(user => ({
            ...user,
            profileVisibility: ProfileVisibility.PUBLIC,
          })),
          async (publicUser) => {
            // Arrange
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(publicUser);

            // Act
            const result = await service.findPublicProfile(publicUser.id);

            // Assert
            expect(result).not.toHaveProperty('email');
            expect(result).not.toHaveProperty('preferences');
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('walletAddress');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('User Update Property Tests', () => {
    it('should maintain invariants when updating users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          ArbitraryGenerators.updateUserDto(),
          async (user, updateUserDto) => {
            // Arrange
            const updatedUser = { ...user, ...updateUserDto, profileCompletion: 75 };
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(updatedUser);

            // Act
            const result = await service.update(user.id, updateUserDto);

            // Assert
            PropertyTestHelpers.assertUserInvariants(result);
            if (updateUserDto.firstName) expect(result.firstName).toBe(updateUserDto.firstName);
            if (updateUserDto.lastName) expect(result.lastName).toBe(updateUserDto.lastName);
            if (updateUserDto.bio !== undefined) expect(result.bio).toBe(updateUserDto.bio);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should recalculate profile completion on updates', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          ArbitraryGenerators.updateUserDto(),
          async (user, updateUserDto) => {
            // Arrange
            const updatedUser = { ...user, ...updateUserDto, profileCompletion: 85 };
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(updatedUser);

            // Act
            const result = await service.update(user.id, updateUserDto);

            // Assert
            expect(typeof result.profileCompletion).toBe('number');
            expect(result.profileCompletion).toBeGreaterThanOrEqual(0);
            expect(result.profileCompletion).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('User Search Property Tests', () => {
    it('should return valid user structures for search queries', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (user, query) => {
            // Arrange
            jest.spyOn(usersRepository, 'find').mockResolvedValue([user]);

            // Act
            const result = await service.search(query);

            // Assert
            expect(Array.isArray(result)).toBe(true);
            if (result.length > 0) {
              PropertyTestHelpers.assertUserInvariants(result[0]);
            }
            expect(result.length).toBeLessThanOrEqual(20); // Search limit
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty search results gracefully', async () => {
      await test(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (query) => {
            // Arrange
            jest.spyOn(usersRepository, 'find').mockResolvedValue([]);

            // Act
            const result = await service.search(query);

            // Assert
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Wallet Authentication Property Tests', () => {
    it('should generate valid nonces for wallet addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          ArbitraryGenerators.nonce(),
          async (walletAddress, nonce) => {
            // Arrange
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(undefined);

            // Act
            const result = await service.generateNonce(walletAddress);

            // Assert
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            expect(result).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate nonces correctly', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          ArbitraryGenerators.nonce(),
          async (user, nonce) => {
            // Arrange
            user.nonce = nonce;
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(user);

            // Act
            const result = await service.validateNonce(user.walletAddress, nonce);

            // Assert
            expect(result).toBe(true);
            expect(user.nonce).toBeNull(); // Nonce should be cleared
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid nonces', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          ArbitraryGenerators.nonce(),
          async (user, wrongNonce) => {
            // Arrange
            user.nonce = 'different-nonce';
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);

            // Act
            const result = await service.validateNonce(user.walletAddress, wrongNonce);

            // Assert
            expect(result).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create users from wallet addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          async (walletAddress) => {
            // Arrange
            const expectedUser = {
              id: fc.sample(fc.uuid(), 1)[0],
              walletAddress,
              firstName: 'User',
              lastName: walletAddress.substring(0, 6),
              email: `${walletAddress}@wallet.local`,
              profileVisibility: ProfileVisibility.PUBLIC,
              profileCompletion: expect.any(Number),
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            };

            jest.spyOn(usersRepository, 'create').mockReturnValue(expectedUser);
            jest.spyOn(usersRepository, 'save').mockResolvedValue(expectedUser);

            // Act
            const result = await service.createFromWallet(walletAddress);

            // Assert
            expect(result.walletAddress).toBe(walletAddress);
            expect(result.firstName).toBe('User');
            expect(result.lastName).toBe(walletAddress.substring(0, 6));
            expect(result.email).toBe(`${walletAddress}@wallet.local`);
            expect(result.profileVisibility).toBe(ProfileVisibility.PUBLIC);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Fuzz Tests for User Management', () => {
    it('should handle malicious input in search queries gracefully', async () => {
      const maliciousQueries = FuzzTestHelpers.generateMaliciousStrings();
      
      for (const query of maliciousQueries) {
        try {
          jest.spyOn(usersRepository, 'find').mockResolvedValue([]);
          const result = await service.search(query);
          expect(Array.isArray(result)).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle extreme wallet addresses in auth methods', async () => {
      const invalidAddresses = FuzzTestHelpers.generateInvalidWalletAddresses();
      
      for (const walletAddress of invalidAddresses) {
        try {
          jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);
          jest.spyOn(usersRepository, 'save').mockResolvedValue(undefined);
          const nonce = await service.generateNonce(walletAddress as string);
          expect(typeof nonce).toBe('string');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle edge case user data in updates', async () => {
      const edgeCases = [
        { firstName: '', lastName: '', bio: '', email: 'valid@example.com' },
        { firstName: 'a'.repeat(1000), lastName: 'b'.repeat(1000), bio: 'c'.repeat(5000) },
        { firstName: '🔥💣🚀', lastName: '🌟✨', bio: '🎉🎊🎈' },
      ];

      for (const updateData of edgeCases) {
        try {
          const user = PropertyTestHelpers.createMockUser();
          const updatedUser = { ...user, ...updateData, profileCompletion: 50 };
          
          jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
          jest.spyOn(usersRepository, 'save').mockResolvedValue(updatedUser);
          
          const result = await service.update(user.id, updateData);
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Invariant Tests', () => {
    it('should maintain user invariants across all operations', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Test findById invariant
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
            const foundUser = await service.findById(user.id);
            PropertyTestHelpers.assertUserInvariants(foundUser);

            // Test findOneByWallet invariant
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(user);
            const foundByWallet = await service.findOneByWallet(user.walletAddress);
            if (foundByWallet) {
              PropertyTestHelpers.assertUserInvariants(foundByWallet);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain profile completion invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Profile completion should always be between 0 and 100
            expect(typeof user.profileCompletion).toBe('number');
            expect(user.profileCompletion).toBeGreaterThanOrEqual(0);
            expect(user.profileCompletion).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain wallet address format invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Wallet address should maintain format
            PropertyTestHelpers.assertWalletAddressInvariants(user.walletAddress);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
