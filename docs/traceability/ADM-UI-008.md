# ADM-UI-008 — Guided Vehicle Builder

## Purpose

This increment makes canonical Vehicle Master entry easier for administrators
without changing the underlying SRS data model or lifecycle rules.

The primary Admin workflow is now:

```text
Make
  ↓
Model
  ↓
Generation
  ↓
Trim / Variant
  ↓
Canonical Vehicle Configuration
     ├── Model Year
     ├── Production Period
     ├── Engine
     ├── Transmission
     ├── Body Type
     ├── Market
     └── Steering Side
```

## SRS alignment

The workflow is grounded in Document 04:

- Vehicle Master is canonical and reusable.
- A Model references a Make.
- A Generation references its parent Model.
- A Trim / Variant references its parent Generation.
- Production year is not assumed to be the same as customer-facing Model Year.
- Engine and Transmission remain canonical master data.
- Market remains independently represented because specifications can differ by market.
- A Vehicle Configuration can represent Make + Model + Generation + Year + Trim
  + Engine + Transmission + Body + Market.
- Not every canonical vehicle record must contain every level; unknown source
  data is left unspecified rather than invented.

The UI therefore encourages progressive completion but does not force
Generation, Trim, Engine, Transmission, Body, Market, year or steering data
when the source does not establish those values.

## Guided Admin flow

### Model handoff

After an Admin creates a Vehicle Model, the portal continues directly to the
Vehicle Builder for that exact model.

Every existing Model row also exposes a **Build vehicle** action.

### Step 1 — Model

The Admin selects Make and Model. The selected Model remains the canonical
parent for the rest of the flow.

### Step 2 — Generation

The builder shows only Generations belonging to the selected Model. The Admin
may select an existing Generation or create one inline with:

- Generation name
- Internal code
- Production start year
- Production end year
- lifecycle status

### Step 3 — Trim / Variant

The builder shows only Trims belonging to the selected Generation. The Admin
may select an existing Trim or create one inline with:

- Trim name
- Trim code
- Equipment level
- applicable start/end year
- lifecycle status

### Step 4 — Canonical configuration

The Admin resolves the vehicle with reusable master data:

- Engine
- Transmission
- Body Type
- Market / Region
- Model Year
- Production start/end
- Steering Side
- lifecycle status

Engine, Transmission, Body Type and Market / Region can be created inline from
Step 4 and the new record is selected immediately. This keeps normal data entry
inside the guided flow while preserving each item as canonical reusable master
data. Advanced maintenance remains available in Master libraries.

A canonical configuration code is suggested from the selected identity and can
be adjusted before save.

Existing configurations are shown for the current Model / Generation / Trim
selection to reduce accidental duplicates.

## Advanced master libraries

The previous flat master-data workspace remains available at:

`/admin/vehicles/configurations/masters`

It is intended for advanced maintenance of:

- Generations
- Trims
- Engines
- Transmissions
- Body Types
- Markets
- Vehicle Configurations

The normal entry flow uses the guided Vehicle Builder.

## Security and backend authority

No authorization or backend lifecycle rule is weakened.

- `vehicle.manage` remains required.
- Browser writes continue through the same same-origin BFF.
- The API remains authoritative for parent consistency, lifecycle constraints,
  immutable canonical codes and optimistic versions.
- No new public mutation route is introduced.

## Related scope

This increment does not implement:

- VIN decoding or VIN-to-Vehicle resolution
- saved customer vehicle profiles

Product-to-Vehicle Fitment, exact/range/conditional fitment and fitment
verification/governance are implemented separately by the compatibility
foundation and consume the same canonical Vehicle Master.
