import { Controller, Get, Version } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('API Versioning')
@Controller('api')
export class ApiController {
  
  @Version('1')
  @Get('status')
  @ApiOperation({ summary: 'Get API status (v1)' })
  @ApiResponse({ status: 200, description: 'API is running (v1)' })
  getStatusV1() {
    return {
      version: '1',
      status: 'OK',
      message: 'This version is deprecated. Please migrate to v2.',
      deprecated: true,
    };
  }

  @Version('2')
  @Get('status')
  @ApiOperation({ summary: 'Get API status (v2)' })
  @ApiResponse({ status: 200, description: 'API is running (v2)' })
  getStatusV2() {
    return {
      version: '2',
      status: 'OK',
      message: 'This is the latest api version.',
    };
  }
}
