# Admin VIN decoder integration

Open **Vehicles → VIN / Chassis Lookup** at `/admin/vehicles/identification`.
Enter a standard 17-character VIN, optionally supply a model-year hint, then choose **Decode & resolve VIN**.

The existing authenticated Admin BFF calls `POST /api/v1/admin/vehicles/identifiers/resolve`.
The API requires an ADMIN account with `vehicle.manage` and returns HTTP 200 for this lookup operation.

Resolution uses the existing identification service in this order:

1. Prefer an Active, VERIFIED identifier mapping to an Active canonical configuration.
2. For an unmapped VIN, call the configured provider (`nhtsa-vpic`) once on the API server.
3. Normalize the returned fields and search Active configured vehicles.
4. Return decoder evidence alongside canonical candidates and the resolution status.

Chassis, frame, and other identifiers use their typed mappings. They do not call the standard VIN decoder.

## Decoder evidence and canonical identity

The optional `decoded` object and `warnings` array are carried through the existing VIN resolver, identification response, and Admin BFF. They are displayed even for `NO_MATCH` and `PARTIAL_MATCH` results. Missing fields display **Not returned**.

Provider `Series` is displayed as **Provider series**; it is not treated as a canonical generation. Only explicitly normalized generation data can constrain a generation match. Optional derivatives remain optional.

Explicit transmission labels (Automatic, Manual, CVT, DCT) and the Sedan/Saloon body label have deterministic vocabulary aliases. Unrecognized descriptions are retained without guessing new vehicle specifications.

A decoded year can match an exact canonical model year or a configuration with no exact model year and a containing known production range. A CURRENT range requires a known start year and no end year. An UNKNOWN end is not assumed to cover the decoded year.

Nonzero or absent provider confirmation codes produce a safe warning. Those results cannot become an automatic `EXACT_MATCH`, even with one candidate and all required fields. Ambiguous candidates remain explicit choices for inspection.

Clients using the separate `POST /api/v1/vin/decode` and `POST /api/v1/vin/resolve` flow must carry the returned `provider`, `decoded`, and `warnings` together. Both VIN and vehicle-identifier resolution accept and preserve supplied warnings; resolving supplied output does not call the decoder a second time. Warning input is limited to 20 strings of at most 500 characters each.

Empty provider evidence and network failures return `DECODE_FAILED`. The attempted provider is named, and no vehicle details are fabricated. The provider request retains its existing eight-second timeout; the BFF allows fifteen seconds.

No vehicle, configuration, identifier mapping, or fitment is created by a lookup. Decoder output alone does not certify parts fitment. Existing masked/fingerprinted identifier audit metadata remains in use, without decoder payloads or raw provider error text.

Provider reference: [NHTSA vPIC API documentation](https://vpic.nhtsa.dot.gov/api/).
Decoder coverage varies by vehicle and market; a partial decode does not supply missing Europe/GCC specifications.

## Verification

Regression coverage includes decoder normalization and failure handling, preservation of partial/no-match evidence, warning-driven partial status, model-year/range query boundaries, verified VIN mapping priority, privacy-safe audit metadata, authenticated BFF forwarding, escaped UI output, and permission-gated Admin HTTP responses.
