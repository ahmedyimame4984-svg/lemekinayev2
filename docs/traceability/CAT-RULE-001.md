# CAT-RULE-001 — Published schema validation engine baseline

## Scope

This increment adds the first runtime consumer of immutable Product Type schema
versions. It validates a proposed Attribute-value payload against either the
current published schema or an exact historical schema version before any
Product/Listing persistence exists.

The catalog hierarchy remains:

`Category → Subcategory → Product Type`

The engine consumes published schema snapshots. It does not read mutable live
assignment configuration during validation.

## Validation contract

Clients submit Attribute values keyed by canonical Attribute code.

The engine validates:

- unknown Attribute codes
- mandatory Attribute presence
- conditional requiredness
- canonical data-type shape
- STATIC SELECT and MULTI_SELECT allowed values
- numeric minimum / maximum constraints
- string or array minimum / maximum length constraints

Validation returns:

- the immutable schema version used
- the schema hash used
- whether the payload is valid
- the Attribute codes that were required for this evaluation
- structured validation issues

The API returns validation failures as a normal validation result rather than
turning seller-entered invalid data into an HTTP server error.

## Conditional requiredness

For an assignment whose requirement is `CONDITIONAL`, the baseline evaluator
supports conditions referencing another Attribute in the same published schema.

Supported operators:

- `EQUALS`
- `NOT_EQUALS`
- `CONTAINS`
- `DOES_NOT_CONTAIN`
- `GREATER_THAN`
- `GREATER_THAN_OR_EQUAL`
- `LESS_THAN`
- `LESS_THAN_OR_EQUAL`
- `IN`
- `NOT_IN`
- `EXISTS`
- `DOES_NOT_EXIST`
- nested `AND` / `OR` groups

Operator text is normalized case-insensitively with spaces/hyphens converted to
underscores.

A condition may optionally state `action: REQUIRED` or `REQUIRE`. Other
actions such as SHOW, HIDE, or VALIDATE are deliberately rejected by this
baseline rather than being misinterpreted as requiredness.

Malformed conditions, unknown trigger Attribute codes, and unsupported actions
produce an explicit `CONDITIONAL_RULE_INVALID` validation issue.

## Data-type baseline

The engine validates the following published data types:

- TEXT / LONG_TEXT / COUNTRY / IMAGE / VIDEO / FILE as strings
- INTEGER as a finite integer
- DECIMAL / MONEY / MEASUREMENT as finite numbers
- BOOLEAN as boolean
- DATE as an ISO-style YYYY-MM-DD string
- DATETIME as a parseable datetime string
- UUID / REFERENCE as UUID strings
- MULTI_SELECT / MULTI_IMAGE as arrays of strings
- MULTI_REFERENCE as arrays of UUID strings
- SELECT as a string and, when STATIC, an approved allowed-value code

STATIC MULTI_SELECT values must all be approved allowed-value codes from the
published snapshot.

## Supported validation-rule JSON

The first safe validation-rule subset is:

- `min`
- `max`
- `minLength`
- `maxLength`

Unsupported validation-rule keys are not silently ignored. They produce
`VALIDATION_RULE_UNSUPPORTED`.

Arbitrary regular expressions are intentionally not executed in this baseline.
A safe format/pattern rule model should be added before supporting general
pattern validation.

## API

`POST /api/v1/catalog/product-types/{id}/schema/validate`

Example request:

```json
{
  "schemaVersion": 3,
  "values": {
    "ATTR_POSITION": "FRONT",
    "ATTR_WEAR_SENSOR": true,
    "ATTR_SENSOR_TYPE": "ABS"
  }
}
```

`schemaVersion` is optional. When omitted, validation uses the current
published schema for an ACTIVE Product Type. When present, the exact immutable
historical schema version is used.

This endpoint performs no write and contains no Seller-specific private data, so
it is exposed alongside the public published-schema read contract. Future
listing submission must call the same validation service server-side before
persistence; client-side validation cannot replace it.

## Follow-up delivery

- Canonical Product Master persistence, typed Product Attribute Values and exact
  schema-version binding are delivered in `PROD-001.md`.

## Deferred scope

- conditional SHOW / HIDE / VALIDATE actions
- actor-specific READ_ONLY enforcement
- safe named format/pattern validators
- REFERENCE target existence checks
- DYNAMIC/dependent value resolution
- vehicle-reference validation
- part-number validation
- compatibility validation
- Seller Offer / Listing persistence
- Seller Offer binding to canonical Product identity
- Seller dynamic form UI

Those layers should build on this validator rather than reimplementing schema
rules independently in each application.
