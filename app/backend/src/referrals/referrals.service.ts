import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { nanoid } from 'nanoid';
import { ReferralCode } from './entities/referral-code.entity';
import { Referral } from './entities/referral.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { ReferralAccount } from './entities/referral-account.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  // Simple configuration — tweak as needed, or move to ConfigService
  private readonly ID_LENGTH = 8;
  private readonly DIRECT_REWARD = 100; // unit points
  private readonly SECOND_LEVEL_REWARD = 50;
  private readonly IP_RATE_LIMIT = 10; // max redemptions per IP per 24h
  private readonly MIN_ACCOUNT_AGE_MS = 60 * 60 * 1000; // 1 hour for naive fraud check

  constructor(
    @InjectRepository(ReferralCode)
    private codesRepo: Repository<ReferralCode>,
    @InjectRepository(Referral)
    private referralsRepo: Repository<Referral>,
    @InjectRepository(ReferralReward)
    private rewardsRepo: Repository<ReferralReward>,
    @InjectRepository(ReferralAccount)
    private accountsRepo: Repository<ReferralAccount>,
    private usersService: UsersService,
  ) { }

  async generateCode (
    userId: string,
    opts?: { maxUses?: number; prefix?: string },
  ) {
    const owner = await this.usersService.findOneById(userId);
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = (opts?.prefix || '') + nanoid(this.ID_LENGTH);
      const exists = await this.codesRepo.findOne({
        where: { code: candidate },
      });
      if (exists) continue;
      const code = this.codesRepo.create({
        code: candidate,
        owner,
        active: true,
        uses: 0,
        maxUses: opts?.maxUses ?? null,
      });
      return this.codesRepo.save(code);
    }
    throw new ConflictException('Unable to generate unique code, try again');
  }

  async getOrCreateAccount (user: User) {
    let acc = await this.accountsRepo.findOne({ where: { user } });
    if (!acc) {
      acc = this.accountsRepo.create({ user, balance: 0 });
      acc = await this.accountsRepo.save(acc);
    }
    return acc;
  }

  // Redeem a code by a logged-in user (referee). idempotencyKey optional.
  async redeemCode (
    refereeId: string,
    codeStr: string,
    opts?: { ip?: string; idempotencyKey?: string; metadata?: any },
  ) {
    const referee = await this.usersService.findOneById(refereeId);
    const code = await this.codesRepo.findOne({
      where: { code: codeStr },
      relations: ['owner'],
    });
    if (!code || !code.active) {
      throw new BadRequestException('Invalid or inactive code');
    }

    // Basic fraud / sanity checks
    if (String(code.owner.id) === String(referee.id)) {
      throw new ForbiddenException('Cannot redeem your own referral code');
    }

    // IP rate limit
    if (opts?.ip) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ipCount = await this.referralsRepo
        .count({
          where: { ipAddress: opts.ip, createdAt: MoreThan(cutoff) as any },
        })
        .catch(() => 0);
      if (ipCount >= this.IP_RATE_LIMIT) {
        throw new ForbiddenException(
          'Too many redemptions from this IP address',
        );
      }
    }

    // Prevent same wallet double redemption for same referrer (simple)
    const existingSamePair = await this.referralsRepo.findOne({
      where: { code: code, referee },
    });
    if (existingSamePair) {
      // Already redeemed this code by this user; return history
      return { message: 'Already redeemed', referral: existingSamePair };
    }

    // Create referral record
    const referral = this.referralsRepo.create({
      code,
      referrer: code.owner,
      referee,
      level: 1,
      ipAddress: opts?.ip ?? null,
      metadata: opts?.metadata ?? null,
    });
    await this.referralsRepo.save(referral);

    // increment code usage and enforce maxUses
    code.uses += 1;
    if (code.maxUses && code.uses > code.maxUses) {
      code.active = false;
    }
    await this.codesRepo.save(code);

    // Calculate and queue rewards (idempotent by idempotencyKey)
    // Direct reward to owner
    const rewardsToCreate: { beneficiary: User; amount: number }[] = [];
    rewardsToCreate.push({
      beneficiary: code.owner,
      amount: this.DIRECT_REWARD,
    });

    // Second-level: if the referrer themselves was referred by someone, reward their referrer
    const referrerReferral = await this.referralsRepo.findOne({
      where: { referee: code.owner },
      relations: ['referrer'],
    });
    if (referrerReferral && referrerReferral.referrer) {
      rewardsToCreate.push({
        beneficiary: referrerReferral.referrer,
        amount: this.SECOND_LEVEL_REWARD,
      });
    }

    const createdRewards = [];
    for (const r of rewardsToCreate) {
      // idempotency: if idempotencyKey provided, ensure unique per beneficiary+key
      if (opts?.idempotencyKey) {
        const existing = await this.rewardsRepo.findOne({
          where: {
            idempotencyKey: opts.idempotencyKey,
            beneficiary: r.beneficiary,
          },
        });
        if (existing) {
          createdRewards.push(existing);
          continue;
        }
      }

      const rr = this.rewardsRepo.create({
        referral,
        beneficiary: r.beneficiary,
        amount: r.amount,
        distributed: false,
        idempotencyKey: opts?.idempotencyKey ?? null,
      });
      createdRewards.push(await this.rewardsRepo.save(rr));
    }

    // Immediately distribute rewards (synchronous; in prod, you might push to job queue)
    const distributed = [];
    for (const rr of createdRewards) {
      const d = await this.distributeReward(rr.id);
      distributed.push(d);
    }

    return { referral, rewards: distributed };
  }

  // Distribute a reward by id (idempotent)
  async distributeReward (rewardId: string) {
    const rr = await this.rewardsRepo.findOne({
      where: { id: rewardId },
      relations: ['beneficiary', 'referral'],
    });
    if (!rr) throw new BadRequestException('Reward not found');

    if (rr.distributed) {
      return rr;
    }

    // Minimal fraud check: ensure referee account isn't brand new (optional)
    try {
      const referee = rr.referral.referee;
      if (
        referee.createdAt &&
        Date.now() - new Date(referee.createdAt).getTime() <
        this.MIN_ACCOUNT_AGE_MS
      ) {
        // flag — do not distribute automatically
        this.logger.warn(
          `Referral flagged as too-new account: referral ${rr.referral.id}`,
        );
        // Option: still save the reward as undistributed so manual review possible
        return rr;
      }
    } catch (err) {
      // continue
    }

    // Ensure account exists and credit balance
    const acc = await this.getOrCreateAccount(rr.beneficiary);
    acc.balance += rr.amount;
    await this.accountsRepo.save(acc);

    rr.distributed = true;
    await this.rewardsRepo.save(rr);
    return rr;
  }

  // Get referral history for a user (both as referrer and referee)
  async getHistory (userId: string) {
    const user = await this.usersService.findOneById(userId);
    const asReferrer = await this.referralsRepo.find({
      where: { referrer: user },
      relations: ['referee', 'code'],
    });
    const asReferee = await this.referralsRepo.find({
      where: { referee: user },
      relations: ['referrer', 'code'],
    });
    return { asReferrer, asReferee };
  }

  // Simple analytics
  async getAnalytics () {
    // totals
    const totalCodes = await this.codesRepo.count();
    const totalReferrals = await this.referralsRepo.count();
    const totalRewards = await this.rewardsRepo.count({
      where: { distributed: true },
    });
    // top referrers
    const raw = await this.referralsRepo
      .createQueryBuilder('r')
      .select('r.referrerId', 'referrerId')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.referrerId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const top = [];
    for (const row of raw) {
      const user = await this.usersService.findOneById(row.referrerId);
      top.push({
        user: { id: user.id, username: user.username },
        referrals: Number(row.count),
      });
    }

    return { totalCodes, totalReferrals, totalRewards, topReferrers: top };
  }
}
