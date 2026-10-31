import { Injectable } from '@nestjs/common';
import type { ProductTypeSchemaVersionResponseDto } from './dto/product-type-schema.dto.js';
import type {
  ProductTypeSchemaValidationResponseDto,
  SchemaValidationIssueDto,
  ValidateProductTypeSchemaDto,
} from './dto/schema-validation.dto.js';
import { CatalogSchemaService } from './catalog-schema.service.js';

/** Listing images/documents do not form part of the shared manufacturer Article. */
const sellerMediaTypes = new Set([
  'IMAGE', 'MULTI_IMAGE', 'DOCUMENT', 'MULTI_DOCUMENT', 'FILE', 'MULTI_FILE',
]);

type SchemaValidationOptions = {
  /** Article persistence and approval ignore Seller listing media fields. */
  skipSellerMediaRequirements?: boolean;
};

type SnapshotAttribute = {
  code: string;
  dataType: string;
  valueSource?: string;
  requirement?: string;
  validationRule?: unknown;
  conditionalRule?: unknown;
  allowedValues?: Array<{
    id?: string;
    code?: string;
  }>;
};

type ConditionRule =
  | {
      operator: string;
      attributeCode?: string;
      value?: unknown;
      conditions?: unknown;
    }
  | Record<string, unknown>;

@Injectable()
export class CatalogSchemaValidationService {
  constructor(private readonly schemas: CatalogSchemaService) {}

  async validate(
    productTypeId: string,
    input: ValidateProductTypeSchemaDto,
  ): Promise<ProductTypeSchemaValidationResponseDto> {
    const schema =
      input.schemaVersion === undefined
        ? await this.schemas.getCurrentPublishedSchema(productTypeId)
        : await this.schemas.getPublishedSchemaVersion(
            productTypeId,
            input.schemaVersion,
          );

    return this.validatePublishedSchema(schema, input.values);
  }

  validatePublishedSchema(
    schema: ProductTypeSchemaVersionResponseDto,
    values: Record<string, unknown>,
    options: SchemaValidationOptions = {},
  ): ProductTypeSchemaValidationResponseDto {
    const attributes = this.readAttributes(schema.snapshot);
    const issues: SchemaValidationIssueDto[] = [];
    const required = new Set<string>();
    const knownCodes = new Set(attributes.map((attribute) => attribute.code));

    for (const suppliedCode of Object.keys(values)) {
      if (!knownCodes.has(suppliedCode)) {
        issues.push({
          code: 'UNKNOWN_ATTRIBUTE',
          attributeCode: suppliedCode,
          message: 'The attribute is not part of this published schema version.',
        });
      }
    }

    for (const attribute of attributes) {
      // Seller media is never mandatory for a canonical manufacturer Article.
      // Still validate its type if a historical/API caller supplies a value.
      if (options.skipSellerMediaRequirements &&
        sellerMediaTypes.has(attribute.dataType) &&
        !this.hasValue(values[attribute.code])
      ) {
        continue;
      }
      const value = values[attribute.code];
      const requirement = attribute.requirement ?? 'OPTIONAL';

      if (requirement === 'MANDATORY') {
        required.add(attribute.code);
      }

      if (requirement === 'CONDITIONAL') {
        const condition = this.evaluateConditionalRule(
          attribute.conditionalRule,
          values,
          knownCodes,
        );

        if (condition.kind === 'invalid') {
          issues.push({
            code: 'CONDITIONAL_RULE_INVALID',
            attributeCode: attribute.code,
            message:
              'The published conditional rule is not supported by the validation engine.',
          });
        } else if (condition.matches) {
          required.add(attribute.code);
        }
      }

      if (required.has(attribute.code) && !this.hasValue(value)) {
        issues.push({
          code: 'MISSING_REQUIRED',
          attributeCode: attribute.code,
          message: 'A value is required by this published schema.',
        });
        continue;
      }

      if (!this.hasValue(value)) continue;

      const typeIssue = this.validateType(attribute, value);
      if (typeIssue) {
        issues.push(typeIssue);
        continue;
      }

      const allowedValueIssue = this.validateAllowedValue(attribute, value);
      if (allowedValueIssue) {
        issues.push(allowedValueIssue);
      }

      issues.push(...this.validateRule(attribute, value));
    }

    return {
      valid: issues.length === 0,
      schemaVersion: schema.schemaVersion,
      schemaHash: schema.schemaHash,
      requiredAttributeCodes: [...required].sort(),
      issues,
    };
  }

  private readAttributes(snapshot: unknown): SnapshotAttribute[] {
    if (!this.isRecord(snapshot) || !Array.isArray(snapshot.attributes)) {
      return [];
    }

    return snapshot.attributes.flatMap((candidate) => {
      if (!this.isRecord(candidate) || typeof candidate.code !== 'string') {
        return [];
      }

      return [
        {
          code: candidate.code,
          dataType:
            typeof candidate.dataType === 'string' ? candidate.dataType : 'TEXT',
          valueSource:
            typeof candidate.valueSource === 'string'
              ? candidate.valueSource
              : undefined,
          requirement:
            typeof candidate.requirement === 'string'
              ? candidate.requirement
              : undefined,
          validationRule: candidate.validationRule,
          conditionalRule: candidate.conditionalRule,
          allowedValues: Array.isArray(candidate.controlledValues)
            ? candidate.controlledValues.flatMap((value) => {
                if (!this.isRecord(value)) return [];
                return [
                  {
                    id: typeof value.id === 'string' ? value.id : undefined,
                    code:
                      typeof value.code === 'string' ? value.code : undefined,
                  },
                ];
              })
            : Array.isArray(candidate.allowedValues)
              ? candidate.allowedValues.flatMap((value) => {
                if (!this.isRecord(value)) return [];
                return [
                  {
                    id: typeof value.id === 'string' ? value.id : undefined,
                    code:
                      typeof value.code === 'string' ? value.code : undefined,
                  },
                ];
                })
              : [],
        },
      ];
    });
  }

  private validateType(
    attribute: SnapshotAttribute,
    value: unknown,
  ): SchemaValidationIssueDto | null {
    const code = attribute.code;
    let valid = true;

    switch (attribute.dataType) {
      case 'TEXT':
      case 'LONG_TEXT':
      case 'COUNTRY':
      case 'IMAGE':
      case 'VIDEO':
      case 'FILE':
      case 'SELECT':
        valid = typeof value === 'string';
        break;
      case 'INTEGER':
        valid = typeof value === 'number' && Number.isInteger(value);
        break;
      case 'DECIMAL':
      case 'MONEY':
      case 'MEASUREMENT':
        valid = typeof value === 'number' && Number.isFinite(value);
        break;
      case 'BOOLEAN':
        valid = typeof value === 'boolean';
        break;
      case 'DATE':
        valid =
          typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
        break;
      case 'DATETIME':
        valid =
          typeof value === 'string' && !Number.isNaN(Date.parse(value));
        break;
      case 'UUID':
      case 'REFERENCE':
        valid = typeof value === 'string' && this.isUuid(value);
        break;
      case 'MULTI_SELECT':
      case 'MULTI_IMAGE':
        valid =
          Array.isArray(value) &&
          value.every((item) => typeof item === 'string');
        break;
      case 'MULTI_REFERENCE':
        valid =
          Array.isArray(value) &&
          value.every(
            (item) => typeof item === 'string' && this.isUuid(item),
          );
        break;
      default:
        valid = false;
        break;
    }

    return valid
      ? null
      : {
          code: 'TYPE_MISMATCH',
          attributeCode: code,
          message: `The value does not match the published ${attribute.dataType} data type.`,
        };
  }

  private validateAllowedValue(
    attribute: SnapshotAttribute,
    value: unknown,
  ): SchemaValidationIssueDto | null {
    if (attribute.valueSource !== 'STATIC') return null;

    const allowed = new Set(
      (attribute.allowedValues ?? []).flatMap((item) =>
        item.code ? [item.code] : [],
      ),
    );

    if (attribute.dataType === 'SELECT') {
      if (typeof value === 'string' && allowed.has(value)) return null;
      return {
        code: 'VALUE_NOT_ALLOWED',
        attributeCode: attribute.code,
        message: 'The value is not an approved STATIC option in this schema.',
      };
    }

    if (attribute.dataType === 'MULTI_SELECT' && Array.isArray(value)) {
      if (
        value.every(
          (item) => typeof item === 'string' && allowed.has(item),
        )
      ) {
        return null;
      }

      return {
        code: 'VALUE_NOT_ALLOWED',
        attributeCode: attribute.code,
        message:
          'One or more values are not approved STATIC options in this schema.',
      };
    }

    return null;
  }

  private validateRule(
    attribute: SnapshotAttribute,
    value: unknown,
  ): SchemaValidationIssueDto[] {
    if (!this.isRecord(attribute.validationRule)) return [];
    const rule = attribute.validationRule;
    const issues: SchemaValidationIssueDto[] = [];
    const supportedKeys = new Set(['min', 'max', 'minLength', 'maxLength']);
    const unsupportedKeys = Object.keys(rule).filter(
      (key) => !supportedKeys.has(key),
    );

    if (unsupportedKeys.length > 0) {
      issues.push(
        this.issue(
          'VALIDATION_RULE_UNSUPPORTED',
          attribute.code,
          `Unsupported published validation rule key(s): ${unsupportedKeys.join(', ')}.`,
        ),
      );
    }

    if (typeof value === 'number') {
      if (typeof rule.min === 'number' && value < rule.min) {
        issues.push(
          this.issue(
            'MIN_VALUE',
            attribute.code,
            `The value must be at least ${rule.min}.`,
          ),
        );
      }
      if (typeof rule.max === 'number' && value > rule.max) {
        issues.push(
          this.issue(
            'MAX_VALUE',
            attribute.code,
            `The value must be at most ${rule.max}.`,
          ),
        );
      }
    }

    if (typeof value === 'string' || Array.isArray(value)) {
      if (
        typeof rule.minLength === 'number' &&
        value.length < rule.minLength
      ) {
        issues.push(
          this.issue(
            'MIN_LENGTH',
            attribute.code,
            `The value must contain at least ${rule.minLength} item(s)/character(s).`,
          ),
        );
      }
      if (
        typeof rule.maxLength === 'number' &&
        value.length > rule.maxLength
      ) {
        issues.push(
          this.issue(
            'MAX_LENGTH',
            attribute.code,
            `The value must contain at most ${rule.maxLength} item(s)/character(s).`,
          ),
        );
      }
    }

    return issues;
  }

  private evaluateConditionalRule(
    rule: unknown,
    values: Record<string, unknown>,
    knownCodes: Set<string>,
  ): { kind: 'valid'; matches: boolean } | { kind: 'invalid' } {
    if (!this.isRecord(rule) || typeof rule.operator !== 'string') {
      return { kind: 'invalid' };
    }

    const operator = this.normalizeOperator(rule.operator);
    if (typeof rule.action === 'string') {
      const action = this.normalizeOperator(rule.action);
      if (action !== 'REQUIRED' && action !== 'REQUIRE') {
        return { kind: 'invalid' };
      }
    }

    if (operator === 'AND' || operator === 'OR') {
      if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
        return { kind: 'invalid' };
      }

      const results = rule.conditions.map((condition) =>
        this.evaluateConditionalRule(condition, values, knownCodes),
      );
      if (results.some((result) => result.kind === 'invalid')) {
        return { kind: 'invalid' };
      }

      const matches = results.map(
        (result) => result.kind === 'valid' && result.matches,
      );
      return {
        kind: 'valid',
        matches:
          operator === 'AND'
            ? matches.every(Boolean)
            : matches.some(Boolean),
      };
    }

    if (
      typeof rule.attributeCode !== 'string' ||
      !knownCodes.has(rule.attributeCode)
    ) {
      return { kind: 'invalid' };
    }

    const actual = values[rule.attributeCode];
    const hasExpectedValue = Object.prototype.hasOwnProperty.call(
      rule,
      'value',
    );

    switch (operator) {
      case 'EQUALS':
        return hasExpectedValue
          ? { kind: 'valid', matches: this.equals(actual, rule.value) }
          : { kind: 'invalid' };
      case 'NOT_EQUALS':
        return hasExpectedValue
          ? { kind: 'valid', matches: !this.equals(actual, rule.value) }
          : { kind: 'invalid' };
      case 'CONTAINS':
        return hasExpectedValue
          ? { kind: 'valid', matches: this.contains(actual, rule.value) }
          : { kind: 'invalid' };
      case 'DOES_NOT_CONTAIN':
        return hasExpectedValue
          ? { kind: 'valid', matches: !this.contains(actual, rule.value) }
          : { kind: 'invalid' };
      case 'GREATER_THAN':
        return typeof rule.value === 'number'
          ? {
              kind: 'valid',
              matches: this.compareNumbers(actual, rule.value, (a, b) => a > b),
            }
          : { kind: 'invalid' };
      case 'GREATER_THAN_OR_EQUAL':
        return typeof rule.value === 'number'
          ? {
              kind: 'valid',
              matches: this.compareNumbers(
                actual,
                rule.value,
                (a, b) => a >= b,
              ),
            }
          : { kind: 'invalid' };
      case 'LESS_THAN':
        return typeof rule.value === 'number'
          ? {
              kind: 'valid',
              matches: this.compareNumbers(actual, rule.value, (a, b) => a < b),
            }
          : { kind: 'invalid' };
      case 'LESS_THAN_OR_EQUAL':
        return typeof rule.value === 'number'
          ? {
              kind: 'valid',
              matches: this.compareNumbers(
                actual,
                rule.value,
                (a, b) => a <= b,
              ),
            }
          : { kind: 'invalid' };
      case 'IN':
        return Array.isArray(rule.value)
          ? {
              kind: 'valid',
              matches: rule.value.some((item) => this.equals(actual, item)),
            }
          : { kind: 'invalid' };
      case 'NOT_IN':
        return Array.isArray(rule.value)
          ? {
              kind: 'valid',
              matches: !rule.value.some((item) => this.equals(actual, item)),
            }
          : { kind: 'invalid' };
      case 'EXISTS':
        return { kind: 'valid', matches: this.hasValue(actual) };
      case 'DOES_NOT_EXIST':
        return { kind: 'valid', matches: !this.hasValue(actual) };
      default:
        return { kind: 'invalid' };
    }
  }

  private normalizeOperator(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  private equals(left: unknown, right: unknown): boolean {
    return left === right;
  }

  private contains(container: unknown, candidate: unknown): boolean {
    if (typeof container === 'string' && typeof candidate === 'string') {
      return container.includes(candidate);
    }
    if (Array.isArray(container)) {
      return container.some((item) => this.equals(item, candidate));
    }
    return false;
  }

  private compareNumbers(
    left: unknown,
    right: unknown,
    compare: (a: number, b: number) => boolean,
  ): boolean {
    return (
      typeof left === 'number' &&
      Number.isFinite(left) &&
      typeof right === 'number' &&
      Number.isFinite(right) &&
      compare(left, right)
    );
  }

  private hasValue(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private issue(
    code: string,
    attributeCode: string,
    message: string,
  ): SchemaValidationIssueDto {
    return { code, attributeCode, message };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
