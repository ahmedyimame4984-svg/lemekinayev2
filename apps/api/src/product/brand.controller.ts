import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { BrandResponseDto } from './dto/product-identity.dto.js';
import { ProductIdentityService } from './product-identity.service.js';

@ApiTags('Brands')
@Public()
@Controller('brands')
export class BrandController {
  constructor(private readonly identity: ProductIdentityService) {}

  @Get()
  @ApiOperation({ summary: 'List ACTIVE canonical Brand Master records' })
  @ApiOkResponse({ type: BrandResponseDto, isArray: true })
  list(): Promise<BrandResponseDto[]> {
    return this.identity.listPublishedBrands();
  }
}
