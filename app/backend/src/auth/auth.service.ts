import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { User, UserRole } from '../users/entities/user.entity';
import { SiweMessage } from 'siwe';
import { randomBytes } from 'crypto';

export interface TokenPayload {
  sub: string;
  wallet: string;
  roles: UserRole[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateNonce(walletAddress: string): Promise<{ nonce: string }> {
    const nonce = await this.usersService.generateNonce(walletAddress);
    return { nonce };
  }

  async verifySiweMessage(message: string, signature: string): Promise<User> {
    try {
      const siweMessage = new SiweMessage(message);
      
      // Verify the message
      const verification = await siweMessage.verify({ signature });
      
      if (!verification.success) {
        throw new UnauthorizedException('SIWE verification failed');
      }
      
      // Validate domain and URI
      const expectedDomain = this.configService.get<string>('SIWE_DOMAIN');
      const expectedUri = this.configService.get<string>('SIWE_URI');
      
      if (siweMessage.domain !== expectedDomain) {
        throw new BadRequestException('Invalid domain in SIWE message');
      }
      
      if (siweMessage.uri !== expectedUri) {
        throw new BadRequestException('Invalid URI in SIWE message');
      }
      
      // Validate nonce
      const isValidNonce = await this.usersService.validateNonce(
        siweMessage.address,
        siweMessage.nonce,
      );
      
      if (!isValidNonce) {
        throw new UnauthorizedException('Invalid or expired nonce');
      }
      
      // Get or create user
      let user = await this.usersService.findOneByWallet(siweMessage.address);
      if (!user) {
        user = await this.usersService.createFromWallet(siweMessage.address);
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid SIWE message or signature');
    }
  }

  async generateTokens(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      wallet: user.walletAddress,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: '7d',
      },
    );

    // Create session
    const sessionId = randomBytes(32).toString('hex');
    await this.sessionsService.createSession(sessionId, user.id, {
      accessToken,
      refreshToken,
      walletAddress: user.walletAddress,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as TokenPayload;
      
      const user = await this.usersService.findOneById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }
      
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
      
      const user = await this.usersService.findOneById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }
      
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, sessionId?: string): Promise<boolean> {
    try {
      if (sessionId) {
        return await this.sessionsService.deleteSession(sessionId);
      } else {
        // Invalidate all sessions for user
        return await this.sessionsService.invalidateUserSessions(userId);
      }
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  async linkWallet(userId: string, message: string, signature: string): Promise<boolean> {
    try {
      const siweMessage = new SiweMessage(message);
      const verification = await siweMessage.verify({ signature });
      
      if (!verification.success) {
        throw new BadRequestException('Invalid signature');
      }
      
      await this.usersService.linkWallet(userId, siweMessage.address);
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to link wallet');
    }
  }

  async getOAuthUrl(provider: string): Promise<{ url: string }> {
    // Implementation for OAuth providers will be added later
    throw new Error('OAuth not implemented yet');
  }

  async handleOAuthCallback(provider: string, code: string): Promise<User> {
    // Implementation for OAuth providers will be added later
    throw new Error('OAuth not implemented yet');
  }
}