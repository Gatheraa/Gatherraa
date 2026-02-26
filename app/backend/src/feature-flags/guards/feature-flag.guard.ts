import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureFlagMeta = this.reflector.get<{ flagKey: string; requireEnabled: boolean }>(
      FEATURE_FLAG_KEY,
      context.getHandler(),
    );

    if (!featureFlagMeta) {
      return true; // No feature flag requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const result = await this.featureFlagsService.evaluateFlag({
      flagKey: featureFlagMeta.flagKey,
      userId: user.id,
      context: {
        role: user.role,
        email: user.email,
        ...user.preferences,
      },
    });

    const isEnabled = result.value === true;

    if (featureFlagMeta.requireEnabled && !isEnabled) {
      throw new ForbiddenException(`Feature "${featureFlagMeta.flagKey}" is not available`);
    }

    if (!featureFlagMeta.requireEnabled && isEnabled) {
      throw new ForbiddenException(`Feature "${featureFlagMeta.flagKey}" is disabled`);
    }

    return true;
  }
}
