import type { CatalogSchemaService } from './catalog-schema.service.js';
import { CatalogSchemaValidationService } from './catalog-schema-validation.service.js';

describe('CatalogSchemaValidationService', () => {
  const schemas = {
    getCurrentPublishedSchema: vi.fn(),
    getPublishedSchemaVersion: vi.fn(),
  };
  const service = new CatalogSchemaValidationService(
    schemas as unknown as CatalogSchemaService,
  );

  const schema = {
    id: '88888888-8888-4888-8888-888888888888',
    productTypeId: '33333333-3333-4333-8333-333333333333',
    schemaVersion: 3,
    schemaHash: 'a'.repeat(64),
    publishedAt: new Date('2026-09-27T18:00:00.000Z'),
    snapshot: {
      productType: {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        slug: 'brake-pad',
      },
      attributes: [
        {
          code: 'ATTR_POSITION',
          dataType: 'SELECT',
          valueSource: 'STATIC',
          requirement: 'MANDATORY',
          allowedValues: [
            { code: 'FRONT', label: 'Front' },
            { code: 'REAR', label: 'Rear' },
          ],
        },
        {
          code: 'ATTR_QUANTITY',
          dataType: 'INTEGER',
          requirement: 'OPTIONAL',
          validationRule: { min: 1, max: 20 },
        },
        {
          code: 'ATTR_WEAR_SENSOR',
          dataType: 'BOOLEAN',
          requirement: 'OPTIONAL',
        },
        {
          code: 'ATTR_SENSOR_TYPE',
          dataType: 'TEXT',
          requirement: 'CONDITIONAL',
          conditionalRule: {
            attributeCode: 'ATTR_WEAR_SENSOR',
            operator: 'EQUALS',
            value: true,
          },
          validationRule: { minLength: 2, maxLength: 40 },
        },
        {
          code: 'ATTR_VOLTAGE',
          dataType: 'DECIMAL',
          requirement: 'CONDITIONAL',
          conditionalRule: {
            operator: 'AND',
            conditions: [
              {
                attributeCode: 'ATTR_POSITION',
                operator: 'IN',
                value: ['FRONT', 'REAR'],
              },
              {
                attributeCode: 'ATTR_QUANTITY',
                operator: 'GREATER_THAN_OR_EQUAL',
                value: 2,
              },
            ],
          },
        },
      ],
      searchableAttributeCodes: ['ATTR_POSITION'],
      filterableAttributeCodes: ['ATTR_POSITION'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    schemas.getCurrentPublishedSchema.mockResolvedValue(schema);
    schemas.getPublishedSchemaVersion.mockResolvedValue(schema);
  });

  it('loads the current published schema when no exact version is requested', async () => {
    const result = await service.validate(schema.productTypeId, {
      values: {
        ATTR_POSITION: 'FRONT',
      },
    });

    expect(result.schemaVersion).toBe(3);
    expect(schemas.getCurrentPublishedSchema).toHaveBeenCalledWith(
      schema.productTypeId,
    );
    expect(schemas.getPublishedSchemaVersion).not.toHaveBeenCalled();
  });

  it('loads an exact historical schema version when requested', async () => {
    await service.validate(schema.productTypeId, {
      schemaVersion: 2,
      values: {
        ATTR_POSITION: 'FRONT',
      },
    });

    expect(schemas.getPublishedSchemaVersion).toHaveBeenCalledWith(
      schema.productTypeId,
      2,
    );
  });

  it('validates mandatory values, data types, allowed values, and numeric ranges', () => {
    const result = service.validatePublishedSchema(schema, {
      ATTR_POSITION: 'SIDEWAYS',
      ATTR_QUANTITY: 0,
      ATTR_WEAR_SENSOR: 'yes',
    });

    expect(result.valid).toBe(false);
    expect(result.requiredAttributeCodes).toContain('ATTR_POSITION');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'VALUE_NOT_ALLOWED',
          attributeCode: 'ATTR_POSITION',
        }),
        expect.objectContaining({
          code: 'MIN_VALUE',
          attributeCode: 'ATTR_QUANTITY',
        }),
        expect.objectContaining({
          code: 'TYPE_MISMATCH',
          attributeCode: 'ATTR_WEAR_SENSOR',
        }),
      ]),
    );
  });

  it('reads controlledValues from the canonical published schema snapshot', () => {
    const canonical = {
      ...schema,
      snapshot: {
        ...schema.snapshot,
        attributes: [
          {
            code: 'ATTR_POSITION',
            dataType: 'SELECT',
            valueSource: 'STATIC',
            requirement: 'MANDATORY',
            controlledValues: [
              { code: 'FRONT', label: 'Front' },
              { code: 'REAR', label: 'Rear' },
            ],
          },
        ],
      },
    };

    const result = service.validatePublishedSchema(canonical, {
      ATTR_POSITION: 'FRONT',
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('separates Seller media attributes from canonical Article checks without bypassing catalog validation', () => {
    const mixed = {
      ...schema,
      snapshot: {
        ...schema.snapshot,
        attributes: [
          ...schema.snapshot.attributes,
          { code: 'ATTR_PRODUCT_IMAGE', dataType: 'IMAGE', requirement: 'MANDATORY' },
          { code: 'ATTR_PRODUCT_DOCUMENT', dataType: 'FILE', requirement: 'MANDATORY' },
          { code: 'ATTR_GALLERY', dataType: 'MULTI_IMAGE', requirement: 'MANDATORY' },
        ],
      },
    };

    const supplied = { ATTR_POSITION: 'FRONT' };
    const standard = service.validatePublishedSchema(mixed, supplied);
    expect(standard.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_REQUIRED', attributeCode: 'ATTR_PRODUCT_IMAGE' }),
      expect.objectContaining({ code: 'MISSING_REQUIRED', attributeCode: 'ATTR_PRODUCT_DOCUMENT' }),
      expect.objectContaining({ code: 'MISSING_REQUIRED', attributeCode: 'ATTR_GALLERY' }),
    ]));

    const canonical = service.validatePublishedSchema(
      mixed, supplied, { skipSellerMediaRequirements: true },
    );
    expect(canonical.issues).toEqual([]);
    expect(canonical.valid).toBe(true);
    expect(canonical.requiredAttributeCodes).not.toContain('ATTR_PRODUCT_IMAGE');
    expect(canonical.requiredAttributeCodes).toContain('ATTR_POSITION');

    const malformedMedia = service.validatePublishedSchema(
      mixed,
      { ...supplied, ATTR_PRODUCT_IMAGE: 42 },
      { skipSellerMediaRequirements: true },
    );
    expect(malformedMedia.issues).toContainEqual(
      expect.objectContaining({ code: 'TYPE_MISMATCH', attributeCode: 'ATTR_PRODUCT_IMAGE' }),
    );

    const unknown = service.validatePublishedSchema(
      mixed,
      { ...supplied, UNKNOWN_CODE: 'value' },
      { skipSellerMediaRequirements: true },
    );
    expect(unknown.issues).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_ATTRIBUTE', attributeCode: 'UNKNOWN_CODE' }),
    );
  });

  it('reports missing mandatory attributes', () => {
    const result = service.validatePublishedSchema(schema, {});

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_REQUIRED',
        attributeCode: 'ATTR_POSITION',
      }),
    );
  });

  it('makes a CONDITIONAL attribute required when its condition matches', () => {
    const result = service.validatePublishedSchema(schema, {
      ATTR_POSITION: 'FRONT',
      ATTR_WEAR_SENSOR: true,
    });

    expect(result.requiredAttributeCodes).toContain('ATTR_SENSOR_TYPE');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_REQUIRED',
        attributeCode: 'ATTR_SENSOR_TYPE',
      }),
    );
  });

  it('supports AND/IN/comparison conditions for conditional requiredness', () => {
    const result = service.validatePublishedSchema(schema, {
      ATTR_POSITION: 'REAR',
      ATTR_QUANTITY: 2,
      ATTR_WEAR_SENSOR: false,
    });

    expect(result.requiredAttributeCodes).toContain('ATTR_VOLTAGE');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_REQUIRED',
        attributeCode: 'ATTR_VOLTAGE',
      }),
    );
  });

  it('accepts a valid payload and returns the schema identity', () => {
    const result = service.validatePublishedSchema(schema, {
      ATTR_POSITION: 'FRONT',
      ATTR_QUANTITY: 2,
      ATTR_WEAR_SENSOR: true,
      ATTR_SENSOR_TYPE: 'ABS',
      ATTR_VOLTAGE: 12.5,
    });

    expect(result).toMatchObject({
      valid: true,
      schemaVersion: 3,
      schemaHash: 'a'.repeat(64),
      issues: [],
    });
    expect(result.requiredAttributeCodes).toEqual([
      'ATTR_POSITION',
      'ATTR_SENSOR_TYPE',
      'ATTR_VOLTAGE',
    ]);
  });

  it('rejects unknown submitted attributes', () => {
    const result = service.validatePublishedSchema(schema, {
      ATTR_POSITION: 'FRONT',
      ATTR_NOT_APPROVED: 'value',
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_ATTRIBUTE',
        attributeCode: 'ATTR_NOT_APPROVED',
      }),
    );
  });

  it('fails explicitly when a conditional rule references an unknown attribute', () => {
    const broken = {
      ...schema,
      snapshot: {
        ...schema.snapshot,
        attributes: [
          ...(schema.snapshot.attributes as Array<Record<string, unknown>>),
          {
            code: 'ATTR_BROKEN',
            dataType: 'TEXT',
            requirement: 'CONDITIONAL',
            conditionalRule: {
              attributeCode: 'ATTR_DOES_NOT_EXIST',
              operator: 'EQUALS',
              value: 'YES',
            },
          },
        ],
      },
    };

    const result = service.validatePublishedSchema(broken, {
      ATTR_POSITION: 'FRONT',
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'CONDITIONAL_RULE_INVALID',
        attributeCode: 'ATTR_BROKEN',
      }),
    );
  });

  it('does not execute unsupported validation-rule semantics silently', () => {
    const unsupported = {
      ...schema,
      snapshot: {
        ...schema.snapshot,
        attributes: [
          {
            code: 'ATTR_PART_NUMBER',
            dataType: 'TEXT',
            requirement: 'MANDATORY',
            validationRule: { pattern: '^ABC' },
          },
        ],
      },
    };

    const result = service.validatePublishedSchema(unsupported, {
      ATTR_PART_NUMBER: 'ABC-123',
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'VALIDATION_RULE_UNSUPPORTED',
        attributeCode: 'ATTR_PART_NUMBER',
      }),
    );
  });

  it('rejects unsupported conditional SHOW/HIDE actions instead of misinterpreting them', () => {
    const unsupported = {
      ...schema,
      snapshot: {
        ...schema.snapshot,
        attributes: [
          {
            code: 'ATTR_SENSOR_TYPE',
            dataType: 'TEXT',
            requirement: 'CONDITIONAL',
            conditionalRule: {
              attributeCode: 'ATTR_WEAR_SENSOR',
              operator: 'EQUALS',
              value: true,
              action: 'SHOW',
            },
          },
          {
            code: 'ATTR_WEAR_SENSOR',
            dataType: 'BOOLEAN',
            requirement: 'OPTIONAL',
          },
        ],
      },
    };

    const result = service.validatePublishedSchema(unsupported, {
      ATTR_WEAR_SENSOR: true,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'CONDITIONAL_RULE_INVALID',
        attributeCode: 'ATTR_SENSOR_TYPE',
      }),
    );
  });
});
