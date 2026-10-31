import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

const catalogMessages: Record<string, string> = {
  MASTER_DATA_PERMANENT_DELETE_BLOCKED:
    'Permanent deletion is blocked. Refresh the deletion check to review the current dependencies.',
  MASTER_DATA_HAS_ACTIVE_DEPENDENCIES:
    'Resolve active dependent records before archiving this master record.',
  MASTER_DATA_LIFECYCLE_VERSION_CONFLICT:
    'This master record changed since you opened it. Reload and try again.',
  MASTER_DATA_RESTORE_STATUS_INVALID:
    'Only an archived master record can be restored.',
  MASTER_DATA_DEPENDENCY_CONFLICT:
    'A dependency changed while this action was running. Refresh the record and try again.',
  MASTER_DATA_REPLACEMENT_BLOCKED:
    'Master-data replacement is blocked because Products, Seller Listings, saved vehicles, or fitment records still depend on the current master data.',
  MASTER_DATA_REPLACEMENT_IN_PROGRESS:
    'A master-data replacement is already running. Wait for it to finish before trying again.',
  CATEGORY_ALREADY_EXISTS:
    'A category already uses this code or slug. Choose a unique value.',
  CATEGORY_PARENT_NOT_ACTIVE:
    'Activate the parent category first, or keep the new subcategory in Draft.',
  CATEGORY_PARENT_NOT_FOUND:
    'The selected parent category no longer exists. Reload the catalog.',
  CATEGORY_VERSION_CONFLICT:
    'This category changed since you opened it. Reload the latest data and try again.',
  CATEGORY_HAS_ACTIVE_CHILDREN:
    'Deactivate active child categories before deactivating this category.',
  CATEGORY_HAS_ACTIVE_PRODUCT_TYPES:
    'Deactivate active Product Types before deactivating this category.',
  CATEGORY_HAS_ACTIVE_PRODUCT_FAMILIES:
    'Deactivate active Product Families before deactivating this category.',
  PRODUCT_FAMILY_ALREADY_EXISTS:
    'A Product Family already uses this code.',
  PRODUCT_FAMILY_CATEGORY_NOT_FOUND:
    'The selected category no longer exists.',
  PRODUCT_FAMILY_CATEGORY_NOT_ACTIVE:
    'Activate the category first, or keep the Product Family in Draft.',
  PRODUCT_FAMILY_IN_USE_CANNOT_MOVE:
    'Move or update dependent Product Types before changing this Product Family category.',
  PRODUCT_FAMILY_HAS_ACTIVE_DEPENDENCIES:
    'Deactivate dependent Product Types and Products before deactivating this Product Family.',
  PRODUCT_FAMILY_VERSION_CONFLICT:
    'This Product Family changed since you opened it. Reload and try again.',
  UNIT_OF_MEASURE_ALREADY_EXISTS:
    'A Unit of Measure already uses this code.',
  UNIT_OF_MEASURE_HAS_ACTIVE_PRODUCTS:
    'Deactivate Products using this Unit before deactivating it.',
  UNIT_OF_MEASURE_VERSION_CONFLICT:
    'This Unit of Measure changed since you opened it. Reload and try again.',
  PRODUCT_TYPE_IMPORT_CSV_INVALID:
    'The Product Type CSV is malformed. Correct the quoted fields or line structure and preview it again.',
  PRODUCT_TYPE_IMPORT_HEADERS_INVALID:
    'The CSV columns do not match the Product Type import format. Export the library and use those column names.',
  PRODUCT_TYPE_IMPORT_TOO_LARGE:
    'This Product Type import batch is too large. Split it into batches of 2,000 rows or fewer.',
  PRODUCT_TYPE_IMPORT_INVALID:
    'The Product Type import changed or contains invalid rows. Preview the latest CSV again before committing.',
  MASTER_DATA_LOCALIZATION_ALREADY_EXISTS:
    'Localized content already exists for this locale.',
  MASTER_DATA_LOCALIZATION_NOT_FOUND:
    'The localized content no longer exists. Reload the Product Type.',
  MASTER_DATA_LOCALIZATION_VERSION_CONFLICT:
    'This localized content changed since you opened it. Reload and try again.',
  EXTERNAL_STANDARD_MAPPING_ALREADY_EXISTS:
    'This external identifier is already mapped to this canonical record.',
  EXTERNAL_STANDARD_MAPPING_NOT_FOUND:
    'The external-standard mapping no longer exists. Reload the Product Type.',
  EXTERNAL_STANDARD_MAPPING_VERSION_CONFLICT:
    'This external-standard mapping changed since you opened it. Reload and try again.',
  PRODUCT_TYPE_ALREADY_EXISTS:
    'A Product Type already uses this code or slug. Choose a unique value.',
  PRODUCT_TYPE_CATEGORY_NOT_ACTIVE:
    'Activate the selected category first, or keep the Product Type in Draft.',
  PRODUCT_TYPE_CATEGORY_NOT_FOUND:
    'The selected category no longer exists. Reload the catalog.',
  PRODUCT_TYPE_FAMILY_NOT_FOUND:
    'The selected Product Family no longer exists.',
  PRODUCT_TYPE_FAMILY_CATEGORY_MISMATCH:
    'The Product Family must belong to the same category as the Product Type.',
  PRODUCT_TYPE_FAMILY_NOT_ACTIVE:
    'Activate the Product Family first, or keep the Product Type in Draft.',
  PRODUCT_TYPE_PARENT_FAMILY_MISMATCH:
    'A sub-product type must use the same Product Family as its parent.',
  PRODUCT_TYPE_PARENT_NOT_FOUND:
    'The selected parent Product Type no longer exists. Reload the catalog.',
  PRODUCT_TYPE_PARENT_CATEGORY_MISMATCH:
    'A sub-product type must stay in the same category as its parent.',
  PRODUCT_TYPE_PARENT_NOT_ACTIVE:
    'Activate the parent Product Type first, or keep the sub-product type in Draft.',
  PRODUCT_TYPE_HAS_CHILDREN_CANNOT_MOVE:
    'Move or remove sub-product types before changing this Product Type category.',
  PRODUCT_TYPE_HAS_ACTIVE_CHILDREN:
    'Deactivate active sub-product types before deactivating this Product Type.',
  PRODUCT_TYPE_VERSION_CONFLICT:
    'This Product Type changed since you opened it. Reload the latest data and try again.',
  PRODUCT_TYPE_HAS_ACTIVE_ATTRIBUTE_ASSIGNMENTS:
    'Deactivate active attribute assignments before deactivating this Product Type.',
  PRODUCT_TYPE_ATTRIBUTE_PRODUCT_TYPE_NOT_ACTIVE:
    'Activate the Product Type first, or keep this attribute assignment in Draft.',
  PRODUCT_TYPE_ATTRIBUTE_ATTRIBUTE_NOT_ACTIVE:
    'Activate the selected Attribute first, or keep this assignment in Draft.',
  PRODUCT_TYPE_ATTRIBUTE_ALREADY_EXISTS:
    'This Attribute is already assigned to the Product Type.',
  PRODUCT_TYPE_ATTRIBUTE_VERSION_CONFLICT:
    'This attribute assignment changed since you opened it. Reload and try again.',
  PRODUCT_TYPE_ATTRIBUTE_CONDITION_REQUIRED:
    'Conditional assignments require a valid conditional rule.',
  PRODUCT_TYPE_SCHEMA_PRODUCT_TYPE_NOT_ACTIVE:
    'Activate the Product Type before publishing its listing schema.',
  PRODUCT_TYPE_SCHEMA_EMPTY:
    'Activate at least one Product Type attribute assignment before publishing.',
  PRODUCT_TYPE_SCHEMA_ATTRIBUTE_NOT_ACTIVE:
    'Every Attribute included in the published schema must be Active.',
  PRODUCT_TYPE_SCHEMA_UNCHANGED:
    'This Product Type configuration is already published. Change the setup before publishing another version.',
  PRODUCT_TYPE_SCHEMA_VERSION_CONFLICT:
    'This Product Type changed since you opened it. Reload before publishing.',
  ATTRIBUTE_IMPORT_CSV_INVALID:
    'The CSV file is malformed. Correct the quoted fields or line structure and preview it again.',
  ATTRIBUTE_IMPORT_HEADERS_INVALID:
    'The CSV columns do not match the Attribute Library import format. Export the library and use those column names.',
  ATTRIBUTE_IMPORT_TOO_LARGE:
    'This Attribute import batch is too large. Split it into batches of 2,000 rows or fewer.',
  ATTRIBUTE_IMPORT_INVALID:
    'The Attribute import changed or contains invalid rows. Preview the latest CSV again before committing.',
  ATTRIBUTE_GROUP_NOT_FOUND:
    'One of the referenced Attribute Groups no longer exists. Preview the CSV again.',
  ATTRIBUTE_GROUP_NOT_ACTIVE:
    'An Active Attribute can only be imported into an Active Attribute Group.',
  ATTRIBUTE_ALREADY_EXISTS:
    'An Attribute already uses this canonical code.',
  ATTRIBUTE_VERSION_CONFLICT:
    'This Attribute changed since you opened it. Reload the latest data and try again.',
  ATTRIBUTE_VALUE_ALREADY_EXISTS:
    'This Attribute already has an allowed value with that code.',
  ATTRIBUTE_VALUE_VERSION_CONFLICT:
    'This allowed value changed since you opened it. Reload the latest data and try again.',
  ATTRIBUTE_NOT_ACTIVE:
    'Activate the parent Attribute Definition first, or keep this allowed value in Draft.',
  ATTRIBUTE_VALUES_NOT_STATIC:
    'Allowed values can only be managed for Attributes whose value source is STATIC.',
  ATTRIBUTE_HAS_ACTIVE_VALUES:
    'Deactivate active allowed values before deactivating this Attribute.',
  ATTRIBUTE_HAS_ACTIVE_ASSIGNMENTS:
    'Deactivate active Product Type assignments before deactivating this Attribute.',
  ATTRIBUTE_NOT_FOUND:
    'The selected Attribute no longer exists. Reload the Attribute Master.',
  ATTRIBUTE_VALUE_NOT_FOUND:
    'The selected allowed value no longer exists. Reload the Attribute Master.',
  PRODUCT_SCHEMA_VALIDATION_FAILED:
    'One or more Product Attribute values do not satisfy the published Product Type schema.',
  PRODUCT_SCHEMA_SNAPSHOT_INVALID:
    'The published Product Type schema is incomplete or invalid for Product creation.',
  PRODUCT_VERSION_CONFLICT:
    'This Product changed since you opened it. Reload the latest data and try again.',
  PRODUCT_NOT_FOUND:
    'The selected Product no longer exists. Reload Product Master.',
  PRODUCT_UPDATE_EMPTY:
    'Change at least one Product field before saving.',
  PRODUCT_BRAND_NOT_FOUND:
    'The selected Brand no longer exists. Reload Brand Master.',
  PRODUCT_BRAND_NOT_ACTIVE:
    'Activate the selected Brand before activating this Product.',
  PRODUCT_PACK_UNIT_REQUIRED:
    'Select a controlled Unit of Measure before entering a pack quantity.',
  PRODUCT_UNIT_NOT_FOUND:
    'The selected Unit of Measure no longer exists.',
  PRODUCT_UNIT_NOT_ACTIVE:
    'Activate the Unit of Measure before activating this Product.',
  PRODUCT_FAMILY_NOT_ACTIVE:
    'Activate the Product Family before activating this Product.',
  PRODUCT_ASSET_ALREADY_EXISTS:
    'This Product already uses the same asset reference.',
  PRODUCT_ASSET_NOT_FOUND:
    'The Product asset no longer exists. Reload the page.',
  PRODUCT_ASSET_VERSION_CONFLICT:
    'This Product asset changed since you opened it. Reload and try again.',
  BRAND_ALREADY_EXISTS:
    'A Brand already uses this canonical code.',
  BRAND_NOT_FOUND:
    'The selected Brand no longer exists. Reload Brand Master.',
  BRAND_VERSION_CONFLICT:
    'This Brand changed since you opened it. Reload and try again.',
  BRAND_HAS_ACTIVE_PRODUCTS:
    'Deactivate Active Products that reference this Brand first.',
  BRAND_HAS_ACTIVE_PART_NUMBERS:
    'Deactivate Active Part Numbers that reference this Brand first.',
  PART_NUMBER_INVALID:
    'Enter a Part Number containing at least one letter or digit.',
  PART_NUMBER_BRAND_NOT_FOUND:
    'The selected Brand no longer exists.',
  PART_NUMBER_BRAND_NOT_ACTIVE:
    'Activate the selected Brand before activating this Part Number.',
  PART_NUMBER_PRODUCT_NOT_ACTIVE:
    'Activate the Product before activating its Part Numbers.',
  PART_NUMBER_NOT_FOUND:
    'The Part Number no longer exists. Reload Product identifiers.',
  PART_NUMBER_VERSION_CONFLICT:
    'This Part Number changed since you opened it. Reload and try again.',
  PART_NUMBER_ALREADY_EXISTS:
    'This Product already has the same normalized Part Number and identifier type.',
  COMPATIBILITY_PRODUCT_NOT_FOUND:
    'The selected Product no longer exists. Reload Product Master.',
  COMPATIBILITY_PRODUCT_NOT_ACTIVE:
    'Activate the Product before activating fitment.',
  COMPATIBILITY_VERIFICATION_REQUIRED:
    'Active fitment requires Approved or Verified evidence.',
  COMPATIBILITY_YEAR_RANGE_INVALID:
    'Fitment start year must be before or equal to the end year.',
  COMPATIBILITY_VEHICLE_CONFIGURATION_NOT_FOUND:
    'The selected Vehicle Configuration no longer exists.',
  COMPATIBILITY_VEHICLE_CONFIGURATION_NOT_ACTIVE:
    'Activate the Vehicle Configuration before activating fitment.',
  COMPATIBILITY_EXACT_REQUIRES_CONFIGURATION:
    'Exact fitment must use a canonical Vehicle Configuration.',
  COMPATIBILITY_MODEL_REQUIRED:
    'Select both Make and Model for this fitment type.',
  COMPATIBILITY_VEHICLE_REFERENCE_NOT_FOUND:
    'One of the selected Vehicle Master references no longer exists.',
  COMPATIBILITY_MODEL_MAKE_MISMATCH:
    'The selected Model does not belong to the selected Make.',
  COMPATIBILITY_GENERATION_MODEL_MISMATCH:
    'The selected Generation does not belong to the selected Model.',
  COMPATIBILITY_TRIM_REQUIRES_GENERATION:
    'Select a Generation before selecting a Trim.',
  COMPATIBILITY_TRIM_GENERATION_MISMATCH:
    'The selected Trim does not belong to the selected Generation.',
  COMPATIBILITY_RANGE_REQUIRES_YEARS:
    'Range fitment requires both start and end years.',
  COMPATIBILITY_CONDITION_REQUIRED:
    'Conditional fitment requires a vehicle constraint or additional condition rule.',
  COMPATIBILITY_CONFIGURATION_MISMATCH:
    'The selected fitment references conflict with the Vehicle Configuration.',
  COMPATIBILITY_CONFIGURATION_YEAR_MISMATCH:
    'The Vehicle Configuration year is outside the fitment range.',
  COMPATIBILITY_YEAR_OUTSIDE_VEHICLE_RANGE:
    'The fitment years are outside the selected vehicle production range.',
  COMPATIBILITY_VEHICLE_REFERENCE_NOT_ACTIVE:
    'Activate the referenced Vehicle Master data before activating fitment.',
  COMPATIBILITY_NOT_FOUND:
    'The fitment record no longer exists. Reload the page.',
  COMPATIBILITY_VERSION_CONFLICT:
    'This fitment record changed since you opened it. Reload and try again.',
};

export function catalogManagementSafeErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof AdminApiError) {
    const domainMessage = error.apiCode
      ? catalogMessages[error.apiCode]
      : undefined;

    if (domainMessage) {
      return jsonNoStore(
        {
          error: {
            code: error.apiCode,
            message: domainMessage,
          },
        },
        error.status,
      );
    }

    if (error.status === 400) {
      return jsonNoStore(
        {
          error: {
            code: 'CATALOG_INVALID_REQUEST',
            message:
              'Check the catalog fields and lifecycle selections, then try again.',
          },
        },
        400,
      );
    }

    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'CATALOG_ACCESS_DENIED',
            message:
              'Your administrator account does not have permission to manage catalog data.',
          },
        },
        403,
      );
    }

    if (error.status === 404) {
      return jsonNoStore(
        {
          error: {
            code: 'CATALOG_RECORD_NOT_FOUND',
            message: 'The catalog record no longer exists. Reload the page.',
          },
        },
        404,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'CATALOG_CONFLICT',
            message:
              'The catalog change conflicts with current data. Reload the latest data and try again.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
