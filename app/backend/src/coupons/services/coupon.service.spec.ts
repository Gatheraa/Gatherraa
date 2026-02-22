import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponService } from '../services/coupon.service';
import {
  Coupon,
  CouponUsage,
  CouponType,
  CouponStatus,
  CouponScope,
  StackabilityRule,
} from '../entities/coupon.entity';

describe('CouponService', () => {
  let service: CouponService;
  let couponRepository: Repository<Coupon>;
  let couponUsageRepository: Repository<CouponUsage>;

  const mockCouponRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockCouponUsageRepository = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        increment: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockCouponRepository,
        },
        {
          provide: getRepositoryToken(CouponUsage),
          useValue: mockCouponUsageRepository,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCacheManager,
        },
        {
          provide: 'DataSource',
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
    couponRepository = module.get<Repository<Coupon>>(
      getRepositoryToken(Coupon),
    );
    couponUsageRepository = module.get<Repository<CouponUsage>>(
      getRepositoryToken(CouponUsage),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCoupon', () => {
    it('should create a percentage coupon successfully', async () => {
      const dto = {
        code: 'TEST10',
        name: 'Test Coupon',
        type: CouponType.PERCENTAGE,
        discountValue: 10,
        maxUses: 100,
        expiresAt: '2024-12-31T23:59:59Z',
      };

      const expectedCoupon = {
        id: 'coupon-123',
        ...dto,
        code: 'TEST10',
        status: CouponStatus.ACTIVE,
        createdBy: 'user-123',
        currentUses: 0,
        minimumAmount: 0,
        affiliateCommission: 0,
        stackabilityRule: StackabilityRule.ALL,
      };

      mockCouponRepository.findOneBy.mockResolvedValue(null);
      mockCouponRepository.create.mockReturnValue(expectedCoupon);
      mockCouponRepository.save.mockResolvedValue(expectedCoupon);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.createCoupon(dto, 'user-123');

      expect(result).toEqual(expectedCoupon);
      expect(mockCouponRepository.create).toHaveBeenCalledWith({
        ...dto,
        code: 'TEST10',
        createdBy: 'user-123',
        status: CouponStatus.ACTIVE,
      });
    });

    it('should throw error for duplicate coupon code', async () => {
      const dto = {
        code: 'EXISTING',
        name: 'Test Coupon',
        type: CouponType.PERCENTAGE,
        discountValue: 10,
      };

      mockCouponRepository.findOneBy.mockResolvedValue({ id: 'existing-id' });

      await expect(service.createCoupon(dto, 'user-123')).rejects.toThrow(
        'Coupon code already exists',
      );
    });
  });

  describe('validateCoupon', () => {
    it('should validate a valid coupon', async () => {
      const coupon = {
        id: 'coupon-123',
        code: 'VALID10',
        name: 'Valid Coupon',
        type: CouponType.PERCENTAGE,
        discountValue: 10,
        status: CouponStatus.ACTIVE,
        maxUses: 100,
        currentUses: 50,
        maxUsesPerUser: 1,
        minimumAmount: 50,
        stackabilityRule: StackabilityRule.ALL,
      };

      mockCouponRepository.findOne.mockResolvedValue(coupon);
      mockCouponUsageRepository.count.mockResolvedValue(0);

      const result = await service.validateCoupon({
        code: 'VALID10',
        userId: 'user-123',
        orderAmount: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount).toBe(90);
    });

    it('should reject expired coupon', async () => {
      const coupon = {
        id: 'coupon-123',
        code: 'EXPIRED',
        status: CouponStatus.ACTIVE,
        expiresAt: new Date('2020-01-01'),
      };

      mockCouponRepository.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: 'EXPIRED',
        userId: 'user-123',
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Coupon has expired');
    });

    it('should reject coupon below minimum amount', async () => {
      const coupon = {
        id: 'coupon-123',
        code: 'MINAMOUNT',
        status: CouponStatus.ACTIVE,
        minimumAmount: 100,
        type: CouponType.PERCENTAGE,
        discountValue: 10,
      };

      mockCouponRepository.findOne.mockResolvedValue(coupon);

      const result = await service.validateCoupon({
        code: 'MINAMOUNT',
        userId: 'user-123',
        orderAmount: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Minimum order amount is 100');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount correctly', async () => {
      const coupon = {
        type: CouponType.PERCENTAGE,
        discountValue: 20,
      };

      // Access private method through type assertion
      const result = (service as any).calculateDiscount(coupon, 100);
      expect(result).toBe(20);
    });

    it('should calculate fixed discount correctly', async () => {
      const coupon = {
        type: CouponType.FIXED,
        discountValue: 15,
      };

      const result = (service as any).calculateDiscount(coupon, 100);
      expect(result).toBe(15);
    });

    it('should not exceed order amount', async () => {
      const coupon = {
        type: CouponType.FIXED,
        discountValue: 150,
      };

      const result = (service as any).calculateDiscount(coupon, 100);
      expect(result).toBe(100);
    });
  });
});
