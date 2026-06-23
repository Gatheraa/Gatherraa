import {
  Body,
  CanActivate,
  Controller,
  INestApplication,
  Injectable,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApp } from '../src/bootstrap';

class BootstrapHarnessDto {
  @IsString()
  name: string;
}

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.headers.authorization) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

@Controller('bootstrap-harness')
class BootstrapHarnessController {
  @Post('validated')
  validated(@Body() body: BootstrapHarnessDto): BootstrapHarnessDto {
    return body;
  }

  @Post('auth')
  @UseGuards(HeaderAuthGuard)
  auth(@Body() body: BootstrapHarnessDto): BootstrapHarnessDto {
    return body;
  }
}

describe('bootstrap middleware hardening', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';

    const moduleFixture = await Test.createTestingModule({
      controllers: [BootstrapHarnessController],
      providers: [HeaderAuthGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    await app.close();
  });

  it('rejects non-whitelisted request body fields with a validation 400', async () => {
    await request(app.getHttpServer())
      .post('/bootstrap-harness/validated')
      .send({ name: 'valid', unexpected: 'blocked' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain('property unexpected should not exist');
      });
  });

  it('returns 401 for a valid guarded request without Authorization', async () => {
    await request(app.getHttpServer())
      .post('/bootstrap-harness/auth')
      .send({ name: 'valid' })
      .expect(401);
  });

  it('allows configured origins through CORS preflight', async () => {
    await request(app.getHttpServer())
      .options('/bootstrap-harness/validated')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000');
  });
});
