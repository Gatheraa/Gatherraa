import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SiweMessage } from 'siwe';

export interface SiweValidateResult {
  address: string;
  chainId: number;
}

@Injectable()
export class SiweStrategy extends PassportStrategy(Strategy, 'siwe') {
  constructor() {
    super();
  }

  async validate(req: any): Promise<SiweValidateResult> {
    const { message, signature } = req.body;
    
    if (!message || !signature) {
      throw new UnauthorizedException('Message and signature required');
    }

    try {
      const siweMessage = new SiweMessage(message);
      const { data: fields } = await siweMessage.verify({ signature });
      
      return {
        address: fields.address,
        chainId: fields.chainId,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid SIWE signature');
    }
  }
}