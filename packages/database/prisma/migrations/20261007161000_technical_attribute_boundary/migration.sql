-- Generic catalog attributes are technical specification criteria only.
-- Article identity, structured fitment, media, warranty and commerce belong to
-- their dedicated domain models. Remove canonical nontechnical attributes from
-- active schemas while preserving any legacy product values as archived history.

CREATE TEMP TABLE _nontechnical_attribute_ids AS
SELECT definition.id
FROM attribute_definitions definition
LEFT JOIN attribute_groups attribute_group
  ON attribute_group.id = definition.group_id
WHERE definition.code IN (
  'ATTR_PRODUCT_TYPE',
  'ATTR_BRAND',
  'ATTR_MANUFACTURER',
  'ATTR_MODEL_NAME',
  'ATTR_MODEL_NUMBER',
  'ATTR_PART_NUMBER',
  'ATTR_OEM_NUMBER',
  'ATTR_MPN',
  'ATTR_CROSS_REFERENCE',
  'ATTR_COMMON_NAME',
  'ATTR_SKU',
  'ATTR_GTIN',
  'ATTR_SERIES',
  'ATTR_CONDITION',
  'ATTR_UNIT_OF_MEASURE',
  'ATTR_COUNTRY_OF_ORIGIN',
  'ATTR_VEHICLE_MAKE',
  'ATTR_VEHICLE_MODEL',
  'ATTR_VEHICLE_GENERATION',
  'ATTR_VEHICLE_TRIM',
  'ATTR_VEHICLE_YEAR',
  'ATTR_YEAR_FROM',
  'ATTR_YEAR_TO',
  'ATTR_ENGINE',
  'ATTR_TRANSMISSION',
  'ATTR_DRIVE_TYPE',
  'ATTR_BODY_STYLE',
  'ATTR_FUEL_TYPE',
  'ATTR_MARKET',
  'ATTR_STEERING_SIDE',
  'ATTR_COMPATIBILITY_TYPE',
  'ATTR_WARRANTY_AVAILABLE',
  'ATTR_WARRANTY_TYPE',
  'ATTR_WARRANTY_PERIOD',
  'ATTR_PACKAGE_QUANTITY',
  'ATTR_PACKAGE_CONTENTS',
  'ATTR_PACKAGE_MATERIAL',
  'ATTR_RECYCLABLE_PACKAGING',
  'ATTR_MAIN_IMAGE',
  'ATTR_PRODUCT_IMAGES',
  'ATTR_INSTALLATION_GUIDE',
  'ATTR_TECHNICAL_DATASHEET',
  'ATTR_VIDEO',
  'ATTR_SEARCH_KEYWORDS',
  'ATTR_FUNCTIONAL_STATUS',
  'ATTR_COSMETIC_CONDITION'
)
OR attribute_group.code IN (
  'IDENTITY',
  'FITMENT',
  'WARRANTY',
  'MEDIA',
  'COMMERCIAL',
  'COMMERCE',
  'PRICING',
  'INVENTORY'
)
OR upper(definition.code) ~ '(^|_)(PRICE|COST|CURRENCY|STOCK|INVENTORY|SKU|GTIN|EAN|UPC|MPN|WARRANTY|PART_NUMBER|PART_NO|ARTICLE_NUMBER|ARTICLE_NO|OEM_NUMBER|OEM_REFERENCE|OEM_REF|OE_NUMBER|OE_REFERENCE|OE_REF|CROSS_REFERENCE|BRAND|MANUFACTURER|DISCOUNT|PROMOTIONAL_PRICE|MIN_ORDER_QUANTITY|AVAILABLE_QUANTITY|QUANTITY_ON_HAND|DELIVERY|COMMERCIAL_TERMS)(_|$)';

CREATE TEMP TABLE _nontechnical_unused_attribute_ids AS
SELECT ids.id
FROM _nontechnical_attribute_ids ids
WHERE NOT EXISTS (
  SELECT 1
  FROM product_attribute_values pav
  WHERE pav.attribute_id = ids.id
);

DELETE FROM product_type_attribute_assignments
WHERE attribute_id IN (SELECT id FROM _nontechnical_attribute_ids);

DELETE FROM product_type_criteria_template_items
WHERE attribute_id IN (SELECT id FROM _nontechnical_attribute_ids);

-- Published schema versions are immutable history and may already be referenced
-- by existing Manufacturer Articles. Preserve those rows, but stop an affected
-- legacy snapshot from being the current schema used for new Article creation.
UPDATE product_types product_type
SET current_schema_version_id = NULL,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE product_type.current_schema_version_id IN (
  SELECT schema_version.id
  FROM product_type_schema_versions schema_version
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      COALESCE(schema_version.snapshot->'attributes', '[]'::jsonb)
    ) attribute
    WHERE attribute->>'code' IN (
      SELECT definition.code
      FROM attribute_definitions definition
      WHERE definition.id IN (SELECT id FROM _nontechnical_attribute_ids)
    )
  )
);

UPDATE attribute_aliases
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE attribute_id IN (
  SELECT ids.id
  FROM _nontechnical_attribute_ids ids
  WHERE NOT EXISTS (
    SELECT 1
    FROM _nontechnical_unused_attribute_ids unused
    WHERE unused.id = ids.id
  )
);

UPDATE attribute_allowed_values
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE attribute_id IN (
  SELECT ids.id
  FROM _nontechnical_attribute_ids ids
  WHERE NOT EXISTS (
    SELECT 1
    FROM _nontechnical_unused_attribute_ids unused
    WHERE unused.id = ids.id
  )
);

DELETE FROM attribute_aliases
WHERE attribute_id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

DELETE FROM attribute_allowed_values
WHERE attribute_id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

DELETE FROM master_data_provenance
WHERE entity_type = 'AttributeDefinition'
  AND entity_id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

DELETE FROM external_standard_mappings
WHERE entity_type = 'AttributeDefinition'
  AND entity_id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

DELETE FROM master_data_localizations
WHERE entity_type = 'AttributeDefinition'
  AND entity_id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

UPDATE attribute_definitions
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT ids.id
  FROM _nontechnical_attribute_ids ids
  WHERE NOT EXISTS (
    SELECT 1
    FROM _nontechnical_unused_attribute_ids unused
    WHERE unused.id = ids.id
  )
);

DELETE FROM attribute_definitions
WHERE id IN (SELECT id FROM _nontechnical_unused_attribute_ids);

UPDATE attribute_groups
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE code IN ('IDENTITY', 'FITMENT', 'WARRANTY', 'MEDIA', 'COMMERCIAL', 'COMMERCE', 'PRICING', 'INVENTORY');

DELETE FROM attribute_groups groups
WHERE groups.code IN ('IDENTITY', 'FITMENT', 'WARRANTY', 'MEDIA', 'COMMERCIAL', 'COMMERCE', 'PRICING', 'INVENTORY')
  AND NOT EXISTS (
    SELECT 1
    FROM attribute_definitions attributes
    WHERE attributes.group_id = groups.id
  );

CREATE TEMP TABLE _nontechnical_option_set_ids AS
SELECT id
FROM attribute_option_sets
WHERE code IN (
  'PRODUCT_CONDITION',
  'FUEL_TYPE',
  'DRIVE_TYPE',
  'BODY_STYLE',
  'STEERING_SIDE',
  'WARRANTY_TYPE',
  'COMPATIBILITY_TYPE',
  'FUNCTIONAL_STATUS',
  'COSMETIC_CONDITION'
);

UPDATE attribute_option_sets
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM _nontechnical_option_set_ids);

UPDATE attribute_option_values
SET status = 'ARCHIVED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE option_set_id IN (
  SELECT option_sets.id
  FROM _nontechnical_option_set_ids option_sets
  WHERE EXISTS (
    SELECT 1
    FROM attribute_definitions attributes
    WHERE attributes.option_set_id = option_sets.id
  )
);

DELETE FROM attribute_option_values
WHERE option_set_id IN (
  SELECT option_sets.id
  FROM _nontechnical_option_set_ids option_sets
  WHERE NOT EXISTS (
    SELECT 1
    FROM attribute_definitions attributes
    WHERE attributes.option_set_id = option_sets.id
  )
);

DELETE FROM attribute_option_sets option_sets
WHERE option_sets.id IN (SELECT id FROM _nontechnical_option_set_ids)
  AND NOT EXISTS (
    SELECT 1
    FROM attribute_definitions attributes
    WHERE attributes.option_set_id = option_sets.id
  );
