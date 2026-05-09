# Changelog

All notable changes to `@wyella/schemas` are recorded here.

## v0.3.0 — 2026-05-09

Phase 1 of PB-AMOS-S03-D1 (control-health calculator engine). Adds calculator I/O types as consumer types of the existing committed `amos.*` schema (no parallel infrastructure introduced per James α disposition).

### Added

- `control-health/` sub-module:
  - `HealthStatusEnum` — locked vocabulary: `effective | degraded | failed | unknown | deferred | overdue` (per CHECK constraint `amos_control_health_valid`).
  - `HealthCalculationBasisSchema` — OPE-132 transparency provenance shape; lives inside `amos.control.health_calculation_basis` jsonb. Carries `requirement_id`, `asset_id`, inputs (applicability rule ref, evidence completeness, deferral state, contributing evidence IDs), and computation metadata (calculator version, decision path, rationale).
  - `ControlHealthRecordSchema` — full row shape for `amos.control` (17 columns). Each row at MVP1 scale represents one (requirement, applicable-equipment) intersection per James α-i disposition.
  - `ControlHealthDistributionSchema` — `Record<HealthStatus, non-negative integer>`; lives inside `amos.assurance_score_snapshot.control_health_distribution` jsonb.
  - `AssuranceScoreSnapshotSchema` — full row shape for `amos.assurance_score_snapshot` (13 columns); polymorphic-scope rollup with pre-aggregated counts.

- `evidence/` sub-module:
  - `EvidenceTypeEnum` — branded open-vocabulary string. No CHECK constraint exists on `amos.evidence.evidence_type`; closed `z.enum()` would reject future SME-authored or AI-extracted types. Branding preserves type-safety while remaining extensible.
  - `KNOWN_EVIDENCE_TYPES` — documentation-grade list of the 30 types observed in production at Sprint 2 close.
  - `EvidenceRecordSchema` — full row shape for `amos.evidence` (22 columns).

### Changed

- `SCHEMAS_VERSION` constant: `0.2.0` → `0.3.0`.
- `npm test` script extended to run new `control-health` and `evidence` test suites.

### Authority

- Subordinate to PB-AMOS-S03-D1-PHASE1 (revised; supersedes 2026-05-08 morning draft).
- Schema shapes lifted verbatim from production via PB-AMOS-S03-D1 Phase 0 probe report (`wyella/probe-output-S03-D1-Phase0.md`, 2026-05-09).
- Enum vocabularies locked from PostgreSQL `CHECK` constraints surfaced by Phase 1 vocabulary probe (`platform-db/scripts/probe-s03-d1-phase1-vocab.ts`).
- DEC ratification: candidate at D1 closure (DEC-870).

### Vocabulary lock decisions

- **HealthStatusEnum:** closed enum (CHECK-enforced in DB).
- **EvidenceTypeEnum:** branded string (NO CHECK constraint in DB); `KNOWN_EVIDENCE_TYPES` provided as recommendation set.

## v0.2.0 — 2026-05-06

Sprint 2 D5.1 — `applicability/` sub-module added (PB-AMOS-S02-D3 applicability rules engine). Cross-repo consumption mechanism established (git+https from amos-engine and amos-extraction).

## v0.1.x — Sprint 2 internals

`parsers/` sub-module (PB-AMOS-S02-D5-1-IMPL); package shell originated as platform-db workspace, relocated to dedicated cross-repo at github.com/wyella/schemas.
