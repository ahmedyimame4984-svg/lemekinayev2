# ADM-UI-007 — Extended Vehicle Master configuration UI

## Scope

This increment exposes the Vehicle Master configuration foundation from
`VEH-002.md` in the protected Admin Portal.

The Admin navigation remains centered on one canonical Vehicle Master:

`Make → Model → Generation → Trim → Vehicle Configuration`

Engine, Transmission, Body Type and Market remain independent master entities
referenced by Vehicle Configuration.

## Admin workspace

The existing Vehicles area now provides:

- Makes
- Models
- Configurations

The Configurations workspace contains dedicated subviews for:

- Generations
- Trims
- Engines
- Transmissions
- Body Types
- Markets
- Vehicle Configurations

Administrators with `vehicle.manage` can create and version-update every
master record exposed by `VEH-002`.

The UI intentionally keeps canonical codes and immutable parent assignments
locked after creation. Lifecycle and hierarchy enforcement remains
authoritative in the API.

## Vehicle Configuration editor

A Vehicle Configuration can bind:

- Make
- Model
- optional Generation
- optional Trim / Variant
- optional Engine
- optional Transmission
- optional Body Type
- optional Market
- optional Model Year
- optional Production start/end years
- optional LHD/RHD steering side

Make and Model are immutable after Configuration creation. Deeper references
may be corrected through optimistic updates.

The form filters Models by selected Make, Generations by selected Model, and
Trims by selected Generation to reduce invalid combinations. The API still
performs the authoritative parent-consistency checks.

## Security / BFF

Browser requests use an allowlisted same-origin BFF:

- `GET|POST /api/admin/vehicles/master/{resource}`
- `PATCH /api/admin/vehicles/master/{resource}/{id}`

Allowed resources are limited to:

- `generations`
- `trims`
- `engines`
- `transmissions`
- `body-types`
- `markets`
- `configurations`

Mutation requests require same-origin checks before the upstream API is called.
The Admin access token remains HttpOnly and server-side.

403, 404 and 409 responses use the existing bounded Vehicle safe-response
mapping.

## Intentional boundaries

This workspace governs canonical Vehicle Master data only. It does not yet
implement:

- Product-to-Vehicle Fitment / Compatibility
- compatibility exactness/range/conditional rules
- fitment source and verification workflows
- VIN decoding or VIN-to-Vehicle resolution
- saved customer vehicle profiles
- bulk vehicle-data import/reconciliation

Those workflows will consume the same centralized Vehicle Master rather than
introducing another vehicle hierarchy.


## Follow-up UX

The primary vehicle-entry workflow is refined in `ADM-UI-008.md`. The
advanced master workspace documented here remains available, while the guided
flow now carries an Admin from Model → Generation → Trim / Variant → canonical
Vehicle Configuration without changing these entity boundaries.
