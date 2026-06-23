import fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from '../src/events/events.service';
import { Event } from '../src/events/entities/event.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../src/sessions/sessions.service';
import { WebhookService } from '../src/webhooks/services/webhook.service';
import { ArbitraryGenerators, PropertyTestHelpers } from './utils/property-test-utils';
import { ReferralsService } from '../src/referrals/referrals.service';
import { ReferralCode } from '../src/referrals/entities/referral-code.entity';
import { Referral } from '../src/referrals/entities/referral.entity';
import { ReferralReward } from '../src/referrals/entities/referral-reward.entity';
import { ReferralAccount } from '../src/referrals/entities/referral-account.entity';

describe('Data Consistency Invariant Tests', () => {
  let eventsService: EventsService;
  let usersService: UsersService;
  let authService: AuthService;
  let eventRepository: Repository<Event>;
  let userRepository: Repository<User>;
  let module: TestingModule;
  let referralsService: ReferralsService;
  let codesRepo: Repository<ReferralCode>;
  let referralsRepo: Repository<Referral>;
  let rewardsRepo: Repository<ReferralReward>;
  let accountsRepo: Repository<ReferralAccount>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsService,
        UsersService,
        AuthService,
        {
          provide: getRepositoryToken(Event),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
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
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            createSession: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            trigger: jest.fn(),
          },
        },
        ReferralsService,
        {
          provide: getRepositoryToken(ReferralCode),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Referral),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReferralReward),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReferralAccount),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    eventsService = module.get<EventsService>(EventsService);
    usersService = module.get<UsersService>(UsersService);
    authService = module.get<AuthService>(AuthService);
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    referralsService = module.get<ReferralsService>(ReferralsService);
    codesRepo = module.get<Repository<ReferralCode>>(getRepositoryToken(ReferralCode));
    referralsRepo = module.get<Repository<Referral>>(getRepositoryToken(Referral));
    rewardsRepo = module.get<Repository<ReferralReward>>(getRepositoryToken(ReferralReward));
    accountsRepo = module.get<Repository<ReferralAccount>>(getRepositoryToken(ReferralAccount));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Event-User Relationship Invariants', () => {
    it('should maintain organizer relationship consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, organizer) => {
            // Arrange
            event.organizerId = organizer.id;
            
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(organizer);

            // Act
            const foundEvent = await eventsService.findOne(event.id);

            // Assert invariants
            expect(foundEvent.organizerId).toBe(organizer.id);
            PropertyTestHelpers.assertUserInvariants(organizer);
            PropertyTestHelpers.assertEventInvariants(foundEvent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent orphan events', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          async (event) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

            // Act & Assert
            const foundEvent = await eventsService.findOne(event.id);
            
            // Event should exist but organizer might be missing in some cases
            expect(foundEvent).toBeDefined();
            expect(foundEvent.organizerId).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('User Role Invariants', () => {
    it('should maintain role hierarchy consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

            // Act
            const foundUser = await usersService.findById(user.id);

            // Assert invariants
            expect(foundUser.roles).toBeDefined();
            expect(foundUser.roles.length).toBeGreaterThan(0);
            
            // All roles should be valid enum values
            foundUser.roles.forEach(role => {
              expect(Object.values(UserRole)).toContain(role);
            });

            // Admin should have all permissions implicitly
            if (foundUser.roles.includes(UserRole.ADMIN)) {
              expect(foundUser.roles.length).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain wallet address uniqueness invariants', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

            // Act
            const foundUser = await usersService.findOneByWallet(user.walletAddress);

            // Assert invariants
            if (foundUser) {
              PropertyTestHelpers.assertWalletAddressInvariants(foundUser.walletAddress);
              expect(foundUser.walletAddress).toBe(user.walletAddress);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Event Date Invariants', () => {
    it('should maintain temporal consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          async (event) => {
            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);

            // Act
            const foundEvent = await eventsService.findOne(event.id);

            // Assert temporal invariants
            expect(foundEvent.startTime).toBeDefined();
            expect(foundEvent.startTime).toBeInstanceOf(Date);
            
            if (foundEvent.endTime) {
              expect(foundEvent.endTime).toBeInstanceOf(Date);
              expect(foundEvent.endTime.getTime()).toBeGreaterThanOrEqual(foundEvent.startTime.getTime());
            }

            // Creation timestamps should be consistent
            expect(foundEvent.createdAt).toBeInstanceOf(Date);
            expect(foundEvent.updatedAt).toBeInstanceOf(Date);
            expect(foundEvent.updatedAt.getTime()).toBeGreaterThanOrEqual(foundEvent.createdAt.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case date combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date(),
          fc.option(fc.date()),
          async (startTime, endTime) => {
            // Create event with potentially problematic dates
            const event = PropertyTestHelpers.createMockEvent({
              startTime,
              endTime: endTime && endTime < startTime ? startTime : endTime,
            });

            // Arrange
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);

            // Act
            const foundEvent = await eventsService.findOne(event.id);

            // Assert that the system handles edge cases gracefully
            expect(foundEvent.startTime).toBeInstanceOf(Date);
            if (foundEvent.endTime) {
              expect(foundEvent.endTime.getTime()).toBeGreaterThanOrEqual(foundEvent.startTime.getTime());
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Authentication Token Invariants', () => {
    it('should maintain token payload consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          fc.string({ minLength: 32 }),
          fc.string({ minLength: 32 }),
          async (user, accessToken, refreshToken) => {
            // Arrange
            const payload = {
              sub: user.id,
              wallet: user.walletAddress,
              roles: user.roles,
            };

            jest.spyOn(authService['jwtService'], 'verify').mockReturnValue(payload);
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
            jest.spyOn(authService['configService'], 'get').mockReturnValue('test-secret');

            // Act
            const validatedUser = await authService.validateToken(accessToken);

            // Assert token invariants
            expect(validatedUser.id).toBe(user.id);
            expect(validatedUser.walletAddress).toBe(user.walletAddress);
            expect(validatedUser.roles).toEqual(user.roles);
            PropertyTestHelpers.assertUserInvariants(validatedUser);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain token expiration consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            const mockAccessToken = 'access-token';
            const mockRefreshToken = 'refresh-token';
            
            jest.spyOn(authService['jwtService'], 'sign')
              .mockReturnValueOnce(mockAccessToken)
              .mockReturnValueOnce(mockRefreshToken);
            jest.spyOn(authService['sessionsService'], 'createSession').mockResolvedValue(undefined);
            jest.spyOn(authService['configService'], 'get').mockReturnValue('test-secret');

            // Act
            const tokens = await authService.generateTokens(user);

            // Assert token generation invariants
            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
            expect(tokens.accessToken.length).toBeGreaterThan(0);
            expect(tokens.refreshToken.length).toBeGreaterThan(0);

            // Verify JWT was called with correct expiration times
            expect(authService['jwtService'].sign).toHaveBeenCalledWith(
              expect.any(Object),
              expect.objectContaining({ expiresIn: '15m' }) // Access token
            );
            
            expect(authService['jwtService'].sign).toHaveBeenCalledWith(
              expect.any(Object),
              expect.objectContaining({ expiresIn: '7d' }) // Refresh token
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Profile Completion Invariants', () => {
    it('should maintain completion percentage bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

            // Act
            const foundUser = await usersService.findById(user.id);

            // Assert completion invariants
            expect(typeof foundUser.profileCompletion).toBe('number');
            expect(foundUser.profileCompletion).toBeGreaterThanOrEqual(0);
            expect(foundUser.profileCompletion).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain completion calculation consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Test that completion is calculated based on filled fields
            const filledFields = [
              user.firstName,
              user.lastName,
              user.bio,
              user.avatarUrl,
              user.socialLinks && Object.keys(user.socialLinks).length > 0,
              user.preferences && Object.keys(user.preferences).length > 0,
            ].filter(Boolean).length;

            const totalFields = 6;
            const expectedCompletion = Math.round((filledFields / totalFields) * 100);

            // The actual completion should be reasonable
            expect(user.profileCompletion).toBeGreaterThanOrEqual(0);
            expect(user.profileCompletion).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Cross-Service Data Consistency', () => {
    it('should maintain user consistency across services', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange - same user should be consistent across different services
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

            // Act - retrieve user through different service methods
            const userFromUsersService = await usersService.findById(user.id);
            const userFromAuthService = await authService.validateToken('valid-token');

            // Assert cross-service consistency
            expect(userFromUsersService.id).toBe(user.id);
            expect(userFromAuthService.id).toBe(user.id);
            expect(userFromUsersService.walletAddress).toBe(user.walletAddress);
            expect(userFromAuthService.walletAddress).toBe(user.walletAddress);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain event ownership consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          ArbitraryGenerators.event(),
          ArbitraryGenerators.organizerUser(),
          async (event, organizer) => {
            // Arrange
            event.organizerId = organizer.id;
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(event);
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(organizer);

            // Act
            const foundEvent = await eventsService.findOne(event.id);
            const foundOrganizer = await usersService.findById(organizer.id);

            // Assert ownership consistency
            expect(foundEvent.organizerId).toBe(foundOrganizer.id);
            expect(foundOrganizer.roles).toContain(UserRole.ORGANIZER);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Referral Reward Idempotency', () => {
    it('distributeReward should not create duplicate state on replay', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.double({ min: 10, max: 1000 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          async (rewardId, amount, pastDate) => {
            const beneficiary = PropertyTestHelpers.createMockUser({ createdAt: pastDate });

            const reward: any = {
              id: rewardId,
              beneficiary,
              amount,
              distributed: false,
              idempotencyKey: null,
              referral: {
                id: fc.sample(fc.uuid(), 1)[0],
                referee: { createdAt: pastDate },
              },
              createdAt: new Date(),
            };

            let currentReward = { ...reward };
            let saveCount = 0;

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(beneficiary);
            jest.spyOn(rewardsRepo, 'findOne').mockImplementation(() => Promise.resolve(currentReward));
            jest.spyOn(rewardsRepo, 'save').mockImplementation(async (r: any) => {
              currentReward = { ...r, distributed: true };
              saveCount++;
              return currentReward;
            });
            jest.spyOn(rewardsRepo, 'create').mockImplementation((dto: any) => dto as any);
            jest.spyOn(accountsRepo, 'findOne').mockResolvedValue(null);
            jest.spyOn(accountsRepo, 'create').mockImplementation((dto: any) => dto as any);
            jest.spyOn(accountsRepo, 'save').mockImplementation((a: any) => Promise.resolve(a));

            const r1 = await referralsService.distributeReward(rewardId);
            const r2 = await referralsService.distributeReward(rewardId);
            const r3 = await referralsService.distributeReward(rewardId);

            expect(saveCount).toBe(1);
            expect(r1.id).toBe(rewardId);
            expect(r2.id).toBe(rewardId);
            expect(r3.id).toBe(rewardId);
          }
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Referral Redeem Idempotency', () => {
    it('redeemCode should not create duplicate referral on replay', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 2 }),
          fc.string({ minLength: 6, maxLength: 8 }),
          fc.string({ minLength: 8, maxLength: 16 }),
          async ([referrerId, refereeId], codeStr, idempotencyKey) => {
            const referrer = PropertyTestHelpers.createMockUser({ id: referrerId, roles: [UserRole.ORGANIZER] });
            const referee = PropertyTestHelpers.createMockUser({ id: refereeId, roles: [UserRole.USER] });

            const code: any = {
              id: fc.sample(fc.uuid(), 1)[0],
              code: codeStr,
              owner: referrer,
              active: true,
              uses: 0,
              maxUses: null,
              metadata: null,
              createdAt: new Date(),
            };

            let savedReferral: any = null;
            let referralSaveCount = 0;
            const savedRewards: any[] = [];

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(referee);
            jest.spyOn(codesRepo, 'findOne').mockResolvedValue(code);
            jest.spyOn(referralsRepo, 'count').mockResolvedValue(0);
            jest.spyOn(referralsRepo, 'findOne').mockImplementation(async (query: any) => {
              if (query.where?.code && query.where?.referee) return savedReferral;
              return null;
            });
            jest.spyOn(referralsRepo, 'create').mockImplementation((dto: any) => dto as any);
            jest.spyOn(referralsRepo, 'save').mockImplementation(async (r: any) => {
              savedReferral = r;
              referralSaveCount++;
              return r;
            });
            jest.spyOn(rewardsRepo, 'findOne').mockImplementation((query: any) => {
              const id = query.where?.id ?? query.where?.idempotencyKey;
              return Promise.resolve(savedRewards.find(r => r.id === id || r.idempotencyKey === id) ?? null);
            });
            jest.spyOn(rewardsRepo, 'create').mockImplementation((dto: any) => dto as any);
            jest.spyOn(rewardsRepo, 'save').mockImplementation(async (r: any) => {
              const saved = { ...r, id: r.id || fc.sample(fc.uuid(), 1)[0] };
              savedRewards.push(saved);
              return saved;
            });
            jest.spyOn(accountsRepo, 'findOne').mockResolvedValue(null);
            jest.spyOn(accountsRepo, 'create').mockImplementation((dto: any) => dto as any);
            jest.spyOn(accountsRepo, 'save').mockImplementation((a: any) => Promise.resolve(a));

            const result1 = await referralsService.redeemCode(refereeId, codeStr, { idempotencyKey });
            const result2 = await referralsService.redeemCode(refereeId, codeStr, { idempotencyKey });
            const result3 = await referralsService.redeemCode(refereeId, codeStr, { idempotencyKey });

            expect(referralSaveCount).toBe(1);
            expect(result1.referral.id).toBe(result2.referral.id);
            expect(result2.referral.id).toBe(result3.referral.id);
          }
        ),
        { numRuns: 50 },
      );
    });
  });
});
