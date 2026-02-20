import { Controller, Post, Body, Get, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('nonce')
  async getNonce(@Req() req: Request) {
    const walletAddress = req.query.wallet as string;
    
    if (!walletAddress) {
      return { error: 'Wallet address is required' };
    }
    
    try {
      const { nonce } = await this.authService.generateNonce(walletAddress);
      return { nonce };
    } catch (error) {
      return { error: 'Failed to generate nonce' };
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('message') message: string,
    @Body('signature') signature: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = await this.authService.verifySiweMessage(message, signature);
      const { accessToken, refreshToken } = await this.authService.generateTokens(user);
      
      // Set cookies
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      return {
        success: true,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          roles: user.roles,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Authentication failed' 
      };
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      return { success: false, error: 'Refresh token required' };
    }
    
    try {
      const { accessToken, refreshToken: newRefreshToken } = await this.authService.refreshTokens(refreshToken);
      
      // Set new cookies
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      
      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Invalid refresh token' };
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as User;
    const sessionId = req.cookies?.session_id;
    
    try {
      await this.authService.logout(user.id, sessionId);
      
      // Clear cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      res.clearCookie('session_id');
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  }

  @Post('link-wallet')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkWallet(
    @Req() req: Request,
    @Body('message') message: string,
    @Body('signature') signature: string,
  ) {
    const user = req.user as User;
    
    try {
      const success = await this.authService.linkWallet(user.id, message, signature);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const user = req.user as User;
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      roles: user.roles,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      linkedWallets: user.linkedWallets,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // OAuth endpoints (to be implemented)
  @Get('oauth/:provider')
  async getOAuthUrl(@Req() req: Request) {
    const provider = req.params.provider as string;
    try {
      const { url } = await this.authService.getOAuthUrl(provider);
      return { url };
    } catch (error) {
      return { error: 'OAuth not implemented' };
    }
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(@Req() req: Request, @Res() res: Response) {
    const provider = req.params.provider as string;
    const code = req.query.code as string;
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=oauth_code_missing`);
    }
    
    try {
      const user = await this.authService.handleOAuthCallback(provider, code);
      const { accessToken, refreshToken } = await this.authService.generateTokens(user);
      
      // Set cookies and redirect
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      res.redirect(`${process.env.FRONTEND_URL}?oauth_success=true`);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
    }
  }
}