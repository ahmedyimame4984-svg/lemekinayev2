import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { CatalogSchemaValidationService } from './catalog-schema-validation.service.js';
import { CatalogSchemaService } from './catalog-schema.service.js';
import { ProductTypeSchemaVersionResponseDto } from './dto/product-type-schema.dto.js';
import {
  ProductTypeSchemaValidationResponseDto,
  ValidateProductTypeSchemaDto,
} from './dto/schema-validation.dto.js';

@ApiTags('Catalog')
@Public()
@Controller('catalog/product-types')
export class CatalogSchemaController {
  constructor(
    private readonly schemas: CatalogSchemaService,
    private readonly validation: CatalogSchemaValidationService,
  ) {}

  @Get(':id/schema')
  @ApiOperation({ summary: 'Retrieve the current published Product Type schema' })
  @ApiOkResponse({ type: ProductTypeSchemaVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Published schema not found' })
  getCurrentSchema(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    return this.schemas.getCurrentPublishedSchema(id);
  }

  @Post(':id/schema/validate')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Validate attribute values against the current or an exact published Product Type schema',
  })
  @ApiOkResponse({ type: ProductTypeSchemaValidationResponseDto })
  @ApiNotFoundResponse({ description: 'Published schema not found' })
  validateSchemaValues(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ValidateProductTypeSchemaDto,
  ): Promise<ProductTypeSchemaValidationResponseDto> {
    return this.validation.validate(id, input);
  }

  @Get(':id/schema/:version')
  @ApiOperation({ summary: 'Retrieve an exact historical Product Type schema version' })
  @ApiOkResponse({ type: ProductTypeSchemaVersionResponseDto })
  @ApiNotFoundResponse({ description: 'Published schema version not found' })
  getSchemaVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    return this.schemas.getPublishedSchemaVersion(id, version);
  }
}
