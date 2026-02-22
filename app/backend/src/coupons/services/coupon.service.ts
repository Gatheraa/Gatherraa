import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Repository,
  DataSource,
  In,
  MoreThanOrEqual,
  LessThanOrEqual,
  IsNull,
} from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  Coupon,
  CouponUsage,
  CouponStatus,
  CouponType,
  CouponScope,
  StackabilityRule,
} from '../entities/coupon.entity';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  ApplyCouponDto,
  BulkGenerateCouponsDto,
  CouponQueryDto,
  CouponValidationResultDto,
  CouponApplicationResultDto,
} from '../dto/coupon.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private couponUsageRepository: Repository<CouponUsage>,
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Create a new coupon
   */
  async createCoupon(dto: CreateCouponDto, createdBy: string): Promise<Coupon> {
    // Validate coupon code uniqueness
    const existingCoupon = await this.couponRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existingCoupon) {
      throw new ConflictException('Coupon code already exists');
    }

    // Validate discount value based on type
    if (
      dto.type === CouponType.PERCENTAGE &&
      (dto.discountValue < 0 || dto.discountValue > 100)
    ) {
      throw new BadRequestException(
        'Percentage discount must be between 0 and 100',
      );
    }

    if (
      dto.type === CouponType.FIXED &&
      (!dto.currency || dto.discountValue < 0)
    ) {
      throw new BadRequestException(
        'Fixed discount requires currency and positive value',
      );
    }

    // Validate dates
    if (
      dto.startsAt &&
      dto.expiresAt &&
      new Date(dto.startsAt) >= new Date(dto.expiresAt)
    ) {
      throw new BadRequestException(
        'Start date must be before expiration date',
      );
    }

    // Validate affiliate commission
    if (
      dto.affiliateId &&
      (!dto.affiliateCommission ||
        dto.affiliateCommission < 0 ||
        dto.affiliateCommission > 100)
    ) {
      throw new BadRequestException(
        'Affiliate commission must be between 0 and 100',
      );
    }

    const coupon = this.couponRepository.create({
      ...dto,
      code: dto.code.toUpperCase(),
      createdBy,
      status: CouponStatus.ACTIVE,
    });

    const savedCoupon = await this.couponRepository.save(coupon);

    // Clear cache
    await this.cacheManager.del(`coupon:${savedCoupon.code}`);

    return savedCoupon;
  }

  /**
   * Update an existing coupon
   */
  async updateCoupon(
    id: string,
    dto: UpdateCouponDto,
    updatedBy: string,
  ): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Validate discount value if updating
    if (dto.discountValue !== undefined) {
      if (
        coupon.type === CouponType.PERCENTAGE &&
        (dto.discountValue < 0 || dto.discountValue > 100)
      ) {
        throw new BadRequestException(
          'Percentage discount must be between 0 and 100',
        );
      }
      if (coupon.type === CouponType.FIXED && dto.discountValue < 0) {
        throw new BadRequestException('Fixed discount must be positive');
      }
    }

    // Validate dates if updating
    const newStartsAt = dto.startsAt ? new Date(dto.startsAt) : coupon.startsAt;
    const newExpiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : coupon.expiresAt;

    if (newStartsAt && newExpiresAt && newStartsAt >= newExpiresAt) {
      throw new BadRequestException(
        'Start date must be before expiration date',
      );
    }

    Object.assign(coupon, { ...dto, updatedBy });

    const savedCoupon = await this.couponRepository.save(coupon);

    // Clear cache
    await this.cacheManager.del(`coupon:${savedCoupon.code}`);

    return savedCoupon;
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(id: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
      relations: ['creator', 'affiliate'],
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  /**
   * Get coupon by code (with caching)
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const cacheKey = `coupon:${code.toUpperCase()}`;
    let coupon: Coupon | null | undefined =
      await this.cacheManager.get<Coupon>(cacheKey);

    if (!coupon) {
      coupon = await this.couponRepository.findOne({
        where: { code: code.toUpperCase() },
        relations: ['creator', 'affiliate'],
      });

      if (coupon) {
        // Cache for 5 minutes
        await this.cacheManager.set(cacheKey, coupon, 300000);
      }
    }

    return coupon ?? null;
  }

  /**
   * Query coupons with filters
   */
  async queryCoupons(
    query: CouponQueryDto,
  ): Promise<{ coupons: Coupon[]; total: number }> {
    const qb = this.couponRepository
      .createQueryBuilder('coupon')
      .leftJoinAndSelect('coupon.creator', 'creator')
      .leftJoinAndSelect('coupon.affiliate', 'affiliate');

    if (query.code) {
      qb.andWhere('coupon.code ILIKE :code', { code: `%${query.code}%` });
    }

    if (query.status) {
      qb.andWhere('coupon.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('coupon.type = :type', { type: query.type });
    }

    if (query.scope) {
      qb.andWhere('coupon.scope = :scope', { scope: query.scope });
    }

    if (query.createdBy) {
      qb.andWhere('coupon.createdBy = :createdBy', {
        createdBy: query.createdBy,
      });
    }

    if (query.affiliateId) {
      qb.andWhere('coupon.affiliateId = :affiliateId', {
        affiliateId: query.affiliateId,
      });
    }

    if (query.userId) {
      qb.andWhere('coupon.userId = :userId', { userId: query.userId });
    }

    if (query.eventId) {
      qb.andWhere('coupon.eventId = :eventId', { eventId: query.eventId });
    }

    if (query.category) {
      qb.andWhere('coupon.category = :category', { category: query.category });
    }

    if (query.expiresBefore) {
      qb.andWhere('coupon.expiresAt <= :expiresBefore', {
        expiresBefore: new Date(query.expiresBefore),
      });
    }

    if (query.expiresAfter) {
      qb.andWhere('coupon.expiresAt >= :expiresAfter', {
        expiresAfter: new Date(query.expiresAfter),
      });
    }

    const total = await qb.getCount();

    qb.orderBy('coupon.createdAt', 'DESC')
      .limit(query.limit)
      .offset(query.offset);

    const coupons = await qb.getMany();

    return { coupons, total };
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(id: string): Promise<void> {
    const coupon = await this.couponRepository.findOne({ where: { id } });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Check if coupon has been used
    const usageCount = await this.couponUsageRepository.count({
      where: { couponId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException('Cannot delete coupon that has been used');
    }

    await this.couponRepository.remove(coupon);

    // Clear cache
    await this.cacheManager.del(`coupon:${coupon.code}`);
  }

  /**
   * Validate coupon for use
   */
  async validateCoupon(
    dto: ValidateCouponDto,
  ): Promise<CouponValidationResultDto> {
    const coupon = await this.getCouponByCode(dto.code);

    if (!coupon) {
      return {
        isValid: false,
        errorMessage: 'Coupon not found',
      };
    }

    // Check status
    if (coupon.status !== CouponStatus.ACTIVE) {
      return {
        isValid: false,
        errorMessage: `Coupon is ${coupon.status}`,
      };
    }

    // Check expiration
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return {
        isValid: false,
        errorMessage: 'Coupon has expired',
      };
    }

    // Check start date
    if (coupon.startsAt && new Date() < coupon.startsAt) {
      return {
        isValid: false,
        errorMessage: 'Coupon is not yet valid',
      };
    }

    // Check usage limits
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return {
        isValid: false,
        errorMessage: 'Coupon usage limit exceeded',
      };
    }

    // Check per-user limits
    if (coupon.maxUsesPerUser) {
      const userUsageCount = await this.couponUsageRepository.count({
        where: { couponId: coupon.id, userId: dto.userId },
      });

      if (userUsageCount >= coupon.maxUsesPerUser) {
        return {
          isValid: false,
          errorMessage: 'Coupon usage limit per user exceeded',
        };
      }
    }

    // Check scope restrictions
    if (
      coupon.scope === CouponScope.USER_SPECIFIC &&
      coupon.userId !== dto.userId
    ) {
      return {
        isValid: false,
        errorMessage: 'Coupon is not valid for this user',
      };
    }

    if (
      coupon.scope === CouponScope.EVENT_SPECIFIC &&
      coupon.eventId !== dto.eventId
    ) {
      return {
        isValid: false,
        errorMessage: 'Coupon is not valid for this event',
      };
    }

    if (
      coupon.scope === CouponScope.CATEGORY_SPECIFIC &&
      coupon.categoryId !== dto.categoryId
    ) {
      return {
        isValid: false,
        errorMessage: 'Coupon is not valid for this category',
      };
    }

    // Check minimum amount
    if (dto.orderAmount && dto.orderAmount < coupon.minimumAmount) {
      return {
        isValid: false,
        errorMessage: `Minimum order amount is ${coupon.minimumAmount}`,
      };
    }

    // Check stackability with existing coupons
    if (dto.existingCoupons && dto.existingCoupons.length > 0) {
      const canStack = await this.checkStackability(
        coupon,
        dto.existingCoupons,
      );
      if (!canStack) {
        return {
          isValid: false,
          errorMessage: 'Coupon cannot be combined with existing coupons',
        };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (dto.orderAmount) {
      discountAmount = this.calculateDiscount(coupon, dto.orderAmount);

      if (coupon.maximumDiscount && discountAmount > coupon.maximumDiscount) {
        discountAmount = coupon.maximumDiscount;
      }
    }

    return {
      isValid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        discountValue: coupon.discountValue,
        currency: coupon.currency,
        minimumAmount: coupon.minimumAmount,
        maximumDiscount: coupon.maximumDiscount,
      },
      discountAmount,
      finalAmount: dto.orderAmount
        ? dto.orderAmount - discountAmount
        : undefined,
    };
  }

  /**
   * Apply coupon to an order (atomic operation)
   */
  async applyCoupon(dto: ApplyCouponDto): Promise<CouponApplicationResultDto> {
    const validation = await this.validateCoupon({
      code: dto.code,
      userId: dto.userId,
      orderAmount: dto.orderAmount,
      existingCoupons: dto.existingCoupons,
      eventId: dto.eventId,
      categoryId: dto.categoryId,
      productIds: dto.productIds,
    });

    if (!validation.isValid) {
      return {
        success: false,
        errorMessage: validation.errorMessage,
      };
    }

    const coupon = await this.getCouponByCode(dto.code);
    if (!coupon) {
      return {
        success: false,
        errorMessage: 'Coupon not found',
      };
    }

    // Use transaction for atomic operation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Increment usage count atomically
      await queryRunner.manager.increment(
        Coupon,
        { id: coupon.id },
        'currentUses',
        1,
      );

      // Create usage record
      const usage = queryRunner.manager.create(CouponUsage, {
        couponId: coupon.id,
        userId: dto.userId,
        orderId: dto.orderId,
        discountAmount: validation.discountAmount,
        currency: coupon.currency,
        usedAt: new Date(),
      });

      await queryRunner.manager.save(usage);

      await queryRunner.commitTransaction();

      // Clear cache
      await this.cacheManager.del(`coupon:${coupon.code}`);

      return {
        success: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          type: coupon.type,
          discountValue: coupon.discountValue,
          currency: coupon.currency,
        },
        discountAmount: validation.discountAmount,
        finalAmount: validation.finalAmount,
        usageId: usage.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to apply coupon');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk generate coupons
   */
  async bulkGenerateCoupons(
    dto: BulkGenerateCouponsDto,
    createdBy: string,
  ): Promise<Coupon[]> {
    const coupons: Coupon[] = [];

    for (let i = 0; i < dto.count; i++) {
      const code = this.generateCouponCode(dto.namePrefix, i);

      const couponDto: CreateCouponDto = {
        code,
        name: `${dto.namePrefix} ${i + 1}`,
        description: dto.description,
        type: dto.type,
        discountValue: dto.discountValue,
        currency: dto.currency,
        maxUses: dto.maxUses,
        maxUsesPerUser: dto.maxUsesPerUser,
        expiresAt: dto.expiresAt,
        startsAt: dto.startsAt,
        stackabilityRule: dto.stackabilityRule,
        category: dto.category,
        minimumAmount: dto.minimumAmount,
        maximumDiscount: dto.maximumDiscount,
      };

      const coupon = await this.createCoupon(couponDto, createdBy);
      coupons.push(coupon);
    }

    return coupons;
  }

  /**
   * Get coupon usage statistics
   */
  async getCouponUsageStats(couponId: string): Promise<{
    totalUses: number;
    uniqueUsers: number;
    totalDiscountAmount: number;
    averageDiscount: number;
  }> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const usages = await this.couponUsageRepository.find({
      where: { couponId },
    });

    const totalUses = usages.length;
    const uniqueUsers = new Set(usages.map((u) => u.userId)).size;
    const totalDiscountAmount = usages.reduce(
      (sum, u) => sum + u.discountAmount,
      0,
    );
    const averageDiscount = totalUses > 0 ? totalDiscountAmount / totalUses : 0;

    return {
      totalUses,
      uniqueUsers,
      totalDiscountAmount,
      averageDiscount,
    };
  }

  /**
   * Check if coupon can be stacked with existing coupons
   */
  private async checkStackability(
    coupon: Coupon,
    existingCouponCodes: string[],
  ): Promise<boolean> {
    if (
      coupon.stackabilityRule === StackabilityRule.NONE ||
      coupon.stackabilityRule === StackabilityRule.EXCLUSIVE
    ) {
      return existingCouponCodes.length === 0;
    }

    if (coupon.stackabilityRule === StackabilityRule.ALL) {
      return true;
    }

    // Check category stackability
    if (coupon.stackabilityRule === StackabilityRule.CATEGORY) {
      const existingCoupons = await this.couponRepository.find({
        where: { code: In(existingCouponCodes) },
      });

      return existingCoupons.every((ec) => ec.category === coupon.category);
    }

    return false;
  }

  /**
   * Calculate discount amount
   */
  private calculateDiscount(coupon: Coupon, orderAmount: number): number {
    let discount = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (orderAmount * coupon.discountValue) / 100;
    } else if (coupon.type === CouponType.FIXED) {
      discount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed order amount
    return Math.min(discount, orderAmount);
  }

  /**
   * Generate unique coupon code
   */
  private generateCouponCode(prefix: string, index: number): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix.toUpperCase()}${timestamp}${random}${index}`.substring(
      0,
      50,
    );
  }

  /**
   * Update expired coupons (to be called by a scheduled job)
   */
  async updateExpiredCoupons(): Promise<number> {
    const result = await this.couponRepository.update(
      {
        status: CouponStatus.ACTIVE,
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: CouponStatus.EXPIRED },
    );

    return result.affected || 0;
  }

  /**
   * Get user's coupon usage history
   */
  async getUserCouponHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<CouponUsage[]> {
    return this.couponUsageRepository.find({
      where: { userId },
      relations: ['coupon'],
      order: { usedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
