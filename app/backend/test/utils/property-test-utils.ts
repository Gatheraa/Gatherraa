import { fc } from 'fast-check';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Event } from '../src/events/entities/event.entity';
import { CreateEventDto } from '../src/events/dto/create-event.dto';
import { UpdateEventDto } from '../src/events/dto/update-event.dto';

export class ArbitraryGenerators {
  static user() {
    return fc.record({
      id: fc.uuid(),
      email: fc.emailAddress(),
      walletAddress: fc.hexaString({ minLength: 42, maxLength: 42 }).map(s => '0x' + s.slice(2)),
      roles: fc.array(fc.constantFrom(...Object.values(UserRole)), { minLength: 1 }),
      isActive: fc.boolean(),
      createdAt: fc.date(),
      updatedAt: fc.date(),
    });
  }

  static organizerUser() {
    return this.user().map(user => ({
      ...user,
      roles: [UserRole.ORGANIZER],
    }));
  }

  static adminUser() {
    return this.user().map(user => ({
      ...user,
      roles: [UserRole.ADMIN],
    }));
  }

  static regularUser() {
    return this.user().map(user => ({
      ...user,
      roles: [UserRole.USER],
    }));
  }

  static event() {
    return fc.record({
      id: fc.uuid(),
      name: fc.lorem({ maxCount: 3 }),
      description: fc.option(fc.lorem({ maxCount: 10 })),
      contractAddress: fc.hexaString({ minLength: 42, maxLength: 42 }).map(s => '0x' + s.slice(2)),
      organizerId: fc.uuid(),
      startTime: fc.date(),
      endTime: fc.option(fc.date()),
      createdAt: fc.date(),
      updatedAt: fc.date(),
    });
  }

  static createUserDto() {
    return fc.record({
      firstName: fc.string({ minLength: 1, maxLength: 50 }),
      lastName: fc.string({ minLength: 1, maxLength: 50 }),
      email: fc.emailAddress(),
      bio: fc.option(fc.string({ maxLength: 500 })),
    });
  }

  static updateUserDto() {
    return fc.record({
      firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
      lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
      email: fc.option(fc.emailAddress()),
      bio: fc.option(fc.string({ maxLength: 500 })),
      profileVisibility: fc.option(fc.constantFrom(...Object.values(ProfileVisibility))),
    });
  }

  static validEventDates() {
    return fc.tuple(fc.date(), fc.option(fc.date())).map(([startTime, endTime]) => {
      const validEndTime = endTime && endTime > startTime ? endTime : new Date(startTime.getTime() + 3600000);
      return { startTime, endTime: validEndTime };
    });
  }

  static walletAddress() {
    return fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => '0x' + s);
  }

  static nonce() {
    return fc.hexaString({ minLength: 16, maxLength: 32 });
  }

  static email() {
    return fc.emailAddress();
  }

  static paginationParams() {
    return fc.record({
      page: fc.nat({ max: 1000 }),
      limit: fc.nat({ min: 1, max: 100 }),
    });
  }

  static stringWithConstraints(minLength = 1, maxLength = 1000) {
    return fc.string({ minLength, maxLength });
  }

  static stringWithSpecialChars() {
    return fc.string({ minLength: 1, maxLength: 100 }).map(s => 
      s + '!@#$%^&*()_+-=[]{}|;:,.<>?'.charAt(Math.floor(Math.random() * 25))
    );
  }

  static unicodeString() {
    return fc.unicodeString({ minLength: 1, maxLength: 100 });
  }

  static largeNumber() {
    return fc.bigInt({ min: BigInt(Number.MIN_SAFE_INTEGER), max: BigInt(Number.MAX_SAFE_INTEGER) });
  }

  static timestamp() {
    return fc.date().getTime();
  }
}

export class PropertyTestHelpers {
  static assertEventInvariants(event: Event) {
    expect(event.id).toBeDefined();
    expect(event.name).toBeDefined();
    expect(event.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    
    if (event.startTime && event.endTime) {
      expect(event.endTime.getTime()).toBeGreaterThanOrEqual(event.startTime.getTime());
    }
    
    expect(event.createdAt).toBeDefined();
    expect(event.updatedAt).toBeDefined();
  }

  static assertUserInvariants(user: User) {
    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(user.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
    expect(user.roles).toBeDefined();
    expect(user.roles.length).toBeGreaterThan(0);
    expect(user.profileCompletion).toBeGreaterThanOrEqual(0);
    expect(user.profileCompletion).toBeLessThanOrEqual(100);
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  }

  static assertPaginationInvariants(page: number, limit: number, totalItems: number) {
    expect(page).toBeGreaterThan(0);
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(100);
    
    const totalPages = Math.ceil(totalItems / limit);
    expect(page).toBeLessThanOrEqual(totalPages || 1);
  }

  static assertDateOrderInvariants(startDate: Date, endDate?: Date) {
    if (endDate) {
      expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    }
  }

  static assertWalletAddressInvariants(address: string) {
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  }

  static assertEmailInvariants(email: string) {
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  }

  static assertTokenInvariants(tokens: { accessToken: string; refreshToken: string }) {
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken.length).toBeGreaterThan(0);
  }

  static assertStringConstraints(str: string, minLength: number, maxLength: number) {
    expect(str.length).toBeGreaterThanOrEqual(minLength);
    expect(str.length).toBeLessThanOrEqual(maxLength);
  }

  static createMockUser(overrides: Partial<User> = {}): User {
    return {
      id: overrides.id || fc.sample(fc.uuid(), 1)[0],
      firstName: overrides.firstName || fc.sample(fc.string({ minLength: 1, maxLength: 50 }), 1)[0],
      lastName: overrides.lastName || fc.sample(fc.string({ minLength: 1, maxLength: 50 }), 1)[0],
      email: overrides.email || fc.sample(fc.emailAddress(), 1)[0],
      walletAddress: overrides.walletAddress || fc.sample(fc.hexaString({ minLength: 42, maxLength: 42 }).map(s => '0x' + s.slice(2)), 1)[0],
      nonce: overrides.nonce !== undefined ? overrides.nonce : null,
      roles: overrides.roles || [UserRole.ATTENDEE],
      linkedWallets: overrides.linkedWallets || [],
      oauthProviders: overrides.oauthProviders || [],
      profileVisibility: overrides.profileVisibility || ProfileVisibility.PUBLIC,
      preferences: overrides.preferences !== undefined ? overrides.preferences : undefined,
      socialLinks: overrides.socialLinks !== undefined ? overrides.socialLinks : undefined,
      username: overrides.username !== undefined ? overrides.username : undefined,
      avatar: overrides.avatar !== undefined ? overrides.avatar : undefined,
      bio: overrides.bio !== undefined ? overrides.bio : undefined,
      profileCompletion: overrides.profileCompletion || 0,
      avatarUrl: overrides.avatarUrl !== undefined ? overrides.avatarUrl : undefined,
      isActive: overrides.isActive ?? true,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides,
    };
  }

  static createMockEvent(overrides: Partial<Event> = {}): Event {
    const startTime = overrides.startTime || new Date();
    const endTime = overrides.endTime || new Date(startTime.getTime() + 3600000);
    
    return {
      id: overrides.id || fc.sample(fc.uuid(), 1)[0],
      name: overrides.name || fc.sample(fc.lorem({ maxCount: 3 }), 1)[0],
      description: overrides.description !== undefined ? overrides.description : fc.sample(fc.option(fc.lorem({ maxCount: 10 })), 1)[0],
      contractAddress: overrides.contractAddress || fc.sample(ArbitraryGenerators.walletAddress(), 1)[0],
      organizerId: overrides.organizerId || fc.sample(fc.uuid(), 1)[0],
      startTime,
      endTime,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides,
    };
  }
}

export class FuzzTestHelpers {
  static generateMaliciousStrings() {
    return [
      '../../etc/passwd',
      '<script>alert("xss")</script>',
      'DROP TABLE users; --',
      '\x00\x01\x02\x03',
      '🔥💣🚀🌟',
      String.fromCharCode(0), // null byte
      '\n\r\t',
      ' '.repeat(10000), // very long whitespace
      'a'.repeat(100000), // very long string
    ];
  }

  static generateEdgeCaseNumbers() {
    return [
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      0,
      -1,
      1,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Infinity,
      -Infinity,
      NaN,
    ];
  }

  static generateEdgeCaseDates() {
    return [
      new Date(0), // Unix epoch
      new Date('1970-01-01T00:00:00.000Z'),
      new Date('2038-01-19T03:14:07.000Z'), // 32-bit timestamp limit
      new Date('9999-12-31T23:59:59.999Z'), // Far future
      new Date('0001-01-01T00:00:00.000Z'), // Far past
    ];
  }

  static generateInvalidWalletAddresses() {
    return [
      '0x', // too short
      '0x123', // too short
      '0x' + 'a'.repeat(41), // wrong length
      '0x' + 'g'.repeat(40), // invalid hex
      '123' + '0x' + 'a'.repeat(40), // wrong prefix
      '0x' + 'A'.repeat(40), // uppercase (should be lowercase)
      '', // empty
      null,
      undefined,
    ];
  }

  static generateInvalidEmails() {
    return [
      'invalid-email',
      '@domain.com',
      'user@',
      'user..name@domain.com',
      'user@.domain.com',
      'user@domain.',
      'user name@domain.com',
      'user@domain..com',
      '',
      null,
      undefined,
    ];
  }
}
