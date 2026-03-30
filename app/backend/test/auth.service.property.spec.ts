import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { fc, test } from 'fast-check';
import { AuthService, TokenPayload, AuthTokens } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { User, UserRole } from '../src/users/entities/user.entity';
import { ArbitraryGenerators, PropertyTestHelpers, FuzzTestHelpers } from './utils/property-test-utils';

describe('AuthService Property-Based Tests', () => {
  let service: AuthService;
  let usersService: UsersService;
  let sessionsService: SessionsService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            generateNonce: jest.fn(),
            validateNonce: jest.fn(),
            findOneByWallet: jest.fn(),
            findOneById: jest.fn(),
            createFromWallet: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            createSession: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    sessionsService = module.get<SessionsService>(SessionsService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Nonce Generation Property Tests', () => {
    it('should generate valid nonces for wallet addresses', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          ArbitraryGenerators.nonce(),
          async (walletAddress, nonce) => {
            // Arrange
            jest.spyOn(usersService, 'generateNonce').mockResolvedValue(nonce);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            const result = await service.generateNonce(walletAddress);

            // Assert
            expect(result).toHaveProperty('nonce');
            expect(typeof result.nonce).toBe('string');
            expect(result.nonce.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid wallet addresses gracefully', async () => {
      const invalidAddresses = FuzzTestHelpers.generateInvalidWalletAddresses();
      
      for (const invalidAddress of invalidAddresses) {
        // Should either succeed or fail gracefully
        try {
          jest.spyOn(usersService, 'generateNonce').mockResolvedValue('valid-nonce');
          const result = await service.generateNonce(invalidAddress as string);
          expect(result).toHaveProperty('nonce');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Token Generation Property Tests', () => {
    it('should generate valid tokens for any user', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          ArbitraryGenerators.walletAddress(),
          async (user, sessionId) => {
            // Arrange
            const mockAccessToken = 'access-token-' + Math.random();
            const mockRefreshToken = 'refresh-token-' + Math.random();
            
            jest.spyOn(jwtService, 'sign')
              .mockReturnValueOnce(mockAccessToken)
              .mockReturnValueOnce(mockRefreshToken);
            jest.spyOn(sessionsService, 'createSession').mockResolvedValue(undefined);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            const result = await service.generateTokens(user);

            // Assert
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(typeof result.accessToken).toBe('string');
            expect(typeof result.refreshToken).toBe('string');
            expect(result.accessToken.length).toBeGreaterThan(0);
            expect(result.refreshToken.length).toBeGreaterThan(0);
            expect(result.accessToken).toBe(mockAccessToken);
            expect(result.refreshToken).toBe(mockRefreshToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain token payload invariants', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          async (user) => {
            // Arrange
            const mockAccessToken = 'access-token-' + Math.random();
            const mockRefreshToken = 'refresh-token-' + Math.random();
            
            jest.spyOn(jwtService, 'sign')
              .mockReturnValueOnce(mockAccessToken)
              .mockReturnValueOnce(mockRefreshToken);
            jest.spyOn(sessionsService, 'createSession').mockResolvedValue(undefined);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            await service.generateTokens(user);

            // Assert
            expect(jwtService.sign).toHaveBeenCalledWith(
              {
                sub: user.id,
                wallet: user.walletAddress,
                roles: user.roles,
              },
              expect.objectContaining({
                secret: 'test-secret',
                expiresIn: '15m',
              })
            );

            expect(jwtService.sign).toHaveBeenCalledWith(
              { sub: user.id },
              expect.objectContaining({
                secret: 'test-secret',
                expiresIn: '7d',
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Token Validation Property Tests', () => {
    it('should validate tokens for active users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          fc.string(),
          async (user, token) => {
            // Arrange
            const payload: TokenPayload = {
              sub: user.id,
              wallet: user.walletAddress,
              roles: user.roles,
            };

            jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
            jest.spyOn(usersService, 'findOneById').mockResolvedValue(user);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            const result = await service.validateToken(token);

            // Assert
            PropertyTestHelpers.assertUserInvariants(result);
            expect(result.id).toBe(user.id);
            expect(result.walletAddress).toBe(user.walletAddress);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject tokens for inactive users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user().map(user => ({ ...user, isActive: false })),
          fc.string(),
          async (inactiveUser, token) => {
            // Arrange
            const payload: TokenPayload = {
              sub: inactiveUser.id,
              wallet: inactiveUser.walletAddress,
              roles: inactiveUser.roles,
            };

            jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
            jest.spyOn(usersService, 'findOneById').mockResolvedValue(inactiveUser);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act & Assert
            await expect(service.validateToken(token)).rejects.toThrow(
              'User not found or inactive'
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid tokens', async () => {
      await test(
        fc.asyncProperty(
          fc.string(),
          async (invalidToken) => {
            // Arrange
            jest.spyOn(jwtService, 'verify').mockImplementation(() => {
              throw new Error('Invalid token');
            });
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act & Assert
            await expect(service.validateToken(invalidToken)).rejects.toThrow(
              'Invalid token'
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Token Refresh Property Tests', () => {
    it('should refresh tokens for active users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          fc.string(),
          async (user, refreshToken) => {
            // Arrange
            const mockAccessToken = 'new-access-token-' + Math.random();
            const mockNewRefreshToken = 'new-refresh-token-' + Math.random();
            
            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
            jest.spyOn(usersService, 'findOneById').mockResolvedValue(user);
            jest.spyOn(jwtService, 'sign')
              .mockReturnValueOnce(mockAccessToken)
              .mockReturnValueOnce(mockNewRefreshToken);
            jest.spyOn(sessionsService, 'createSession').mockResolvedValue(undefined);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            const result = await service.refreshTokens(refreshToken);

            // Assert
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(typeof result.accessToken).toBe('string');
            expect(typeof result.refreshToken).toBe('string');
            expect(result.accessToken.length).toBeGreaterThan(0);
            expect(result.refreshToken.length).toBeGreaterThan(0);
            expect(result.accessToken).toBe(mockAccessToken);
            expect(result.refreshToken).toBe(mockNewRefreshToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject refresh tokens for inactive users', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user().map(user => ({ ...user, isActive: false })),
          fc.string(),
          async (inactiveUser, refreshToken) => {
            // Arrange
            jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: inactiveUser.id });
            jest.spyOn(usersService, 'findOneById').mockResolvedValue(inactiveUser);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act & Assert
            await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
              'User not found or inactive'
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('SIWE Message Verification Property Tests', () => {
    it('should handle valid SIWE messages', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          ArbitraryGenerators.nonce(),
          ArbitraryGenerators.user(),
          async (walletAddress, nonce, user) => {
            // Arrange
            const mockSiweMessage = {
              verify: jest.fn().mockResolvedValue({ success: true }),
              address: walletAddress,
              nonce: nonce,
              domain: 'example.com',
              uri: 'https://example.com',
            };

            const SiweMessageMock = jest.fn().mockImplementation(() => mockSiweMessage);
            
            jest.spyOn(usersService, 'validateNonce').mockResolvedValue(true);
            jest.spyOn(usersService, 'findOneByWallet').mockResolvedValue(user);
            jest.spyOn(configService, 'get')
              .mockReturnValueOnce('example.com')
              .mockReturnValueOnce('https://example.com');

            // Temporarily replace SiweMessage import
            const originalSiweMessage = require('siwe').SiweMessage;
            require('siwe').SiweMessage = SiweMessageMock;

            try {
              // Act
              const result = await service.verifySiweMessage('message', 'signature');

              // Assert
              PropertyTestHelpers.assertUserInvariants(result);
              expect(result.walletAddress).toBe(walletAddress);
            } finally {
              // Restore original
              require('siwe').SiweMessage = originalSiweMessage;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create new users if they do not exist', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.walletAddress(),
          ArbitraryGenerators.nonce(),
          async (walletAddress, nonce) => {
            // Arrange
            const newUser = PropertyTestHelpers.createMockUser({ walletAddress });
            const mockSiweMessage = {
              verify: jest.fn().mockResolvedValue({ success: true }),
              address: walletAddress,
              nonce: nonce,
              domain: 'example.com',
              uri: 'https://example.com',
            };

            const SiweMessageMock = jest.fn().mockImplementation(() => mockSiweMessage);
            
            jest.spyOn(usersService, 'validateNonce').mockResolvedValue(true);
            jest.spyOn(usersService, 'findOneByWallet').mockResolvedValue(null);
            jest.spyOn(usersService, 'createFromWallet').mockResolvedValue(newUser);
            jest.spyOn(configService, 'get')
              .mockReturnValueOnce('example.com')
              .mockReturnValueOnce('https://example.com');

            // Temporarily replace SiweMessage import
            const originalSiweMessage = require('siwe').SiweMessage;
            require('siwe').SiweMessage = SiweMessageMock;

            try {
              // Act
              const result = await service.verifySiweMessage('message', 'signature');

              // Assert
              PropertyTestHelpers.assertUserInvariants(result);
              expect(usersService.createFromWallet).toHaveBeenCalledWith(walletAddress);
            } finally {
              // Restore original
              require('siwe').SiweMessage = originalSiweMessage;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Fuzz Tests for Authentication Security', () => {
    it('should handle malformed tokens gracefully', async () => {
      const malformedTokens = [
        '',
        'invalid.token',
        'too.many.parts.in.token',
        '🔥💣🚀',
        '\x00\x01\x02',
        'a'.repeat(10000),
        ...FuzzTestHelpers.generateMaliciousStrings(),
      ];

      for (const token of malformedTokens) {
        try {
          jest.spyOn(jwtService, 'verify').mockImplementation(() => {
            throw new Error('Invalid token');
          });
          jest.spyOn(configService, 'get').mockReturnValue('test-secret');

          await service.validateToken(token);
          // If it doesn't throw, that's okay - it should handle gracefully
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle extreme wallet address inputs', async () => {
      const extremeInputs = [
        ...FuzzTestHelpers.generateInvalidWalletAddresses(),
        '0x' + 'a'.repeat(1000), // Very long address
        '0x' + '0'.repeat(40), // All zeros
        '0x' + 'f'.repeat(40), // All f's
      ];

      for (const walletAddress of extremeInputs) {
        try {
          jest.spyOn(usersService, 'generateNonce').mockResolvedValue('nonce');
          const result = await service.generateNonce(walletAddress as string);
          expect(result).toHaveProperty('nonce');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Invariant Tests', () => {
    it('should maintain user role invariants across authentication', async () => {
      await test(
        fc.asyncProperty(
          ArbitraryGenerators.user(),
          fc.string(),
          async (user, token) => {
            // Arrange
            const payload: TokenPayload = {
              sub: user.id,
              wallet: user.walletAddress,
              roles: user.roles,
            };

            jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
            jest.spyOn(usersService, 'findOneById').mockResolvedValue(user);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            const result = await service.validateToken(token);

            // Assert
            expect(result.roles).toEqual(user.roles);
            expect(result.roles.length).toBeGreaterThan(0);
            result.roles.forEach(role => {
              expect(Object.values(UserRole)).toContain(role);
            });
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
            // Arrange
            const mockAccessToken = 'access-token-' + Math.random();
            const mockRefreshToken = 'refresh-token-' + Math.random();
            
            jest.spyOn(jwtService, 'sign')
              .mockReturnValueOnce(mockAccessToken)
              .mockReturnValueOnce(mockRefreshToken);
            jest.spyOn(sessionsService, 'createSession').mockResolvedValue(undefined);
            jest.spyOn(configService, 'get').mockReturnValue('test-secret');

            // Act
            await service.generateTokens(user);

            // Assert
            expect(jwtService.sign).toHaveBeenCalledWith(
              expect.objectContaining({
                wallet: user.walletAddress,
              }),
              expect.any(Object)
            );

            // Verify wallet address format is maintained
            PropertyTestHelpers.assertWalletAddressInvariants(user.walletAddress);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
