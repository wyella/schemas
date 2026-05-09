/**
 * Control health + assurance rollup schemas for the AMOS calculator.
 *
 * Producer: wyella/amos-engine calculator routes (Phase 3) write
 * `amos.control` rows (one per (requirement, applicable-equipment)
 * intersection per James α-i disposition) and `amos.assurance_score_snapshot`
 * rollups. Consumer: wyella/amos UI cockpit + audit-pack generator (Sprint 5).
 *
 * Subordinate to PB-AMOS-S03-D1-PHASE1 — calculator I/O types. Schema
 * shapes lifted verbatim from production via PB-AMOS-S03-D1 Phase 0
 * probe report (2026-05-09); enum vocabularies locked from CHECK
 * constraints surfaced by Phase 1 vocabulary probe.
 *
 * The shapes here are CONSUMER TYPES of the existing committed amos.*
 * schema (no parallel infrastructure introduced per James α
 * disposition — directive PB-AMOS-S03-D1 Phase 0 §9). Phase 2 calculator
 * function targets these shapes directly.
 */
import { z } from 'zod';

// -- Health status -----------------------------------------------------

/**
 * Locked vocabulary for `amos.control.health_status`.
 *
 * CHECK constraint `amos_control_health_valid` enforces these 6 values:
 *   effective — control is operating as intended; evidence is present
 *               and within validity window
 *   degraded  — control is operating but with diminished assurance
 *               (partial evidence, late evidence, or threshold breach)
 *   failed    — control evidence indicates non-compliance
 *   unknown   — calculator could not determine state (insufficient data)
 *   deferred  — an active amos.deferral row exists for this control
 *   overdue   — required evidence is past its due date
 *
 * The 4-counter aggregate on amos.assurance_score_snapshot
 * (overdue_count, missing_evidence_count, active_deferral_count,
 * expired_deferral_count) maps to subsets of this vocabulary.
 */
export const HealthStatusEnum = z.enum([
  'effective',
  'degraded',
  'failed',
  'unknown',
  'deferred',
  'overdue',
]);
export type HealthStatus = z.infer<typeof HealthStatusEnum>;

// -- Health calculation basis (jsonb provenance) -----------------------

/**
 * OPE-132 transparency surface. Lives inside
 * `amos.control.health_calculation_basis` jsonb. Encodes the
 * (requirement, equipment) link plus the inputs and decision path
 * that produced `health_status` for this control row.
 *
 * Per James α-i: `requirement_id` + `asset_id` are the link from a
 * synthesised intersection-control back to the inputs that produced
 * it. Calculator must populate every field to honour OPE-132 (every
 * health value traces to contributing records).
 *
 * Phase 2 calculator decides naming + content of `decision_path`
 * entries; the schema commits the SHAPE only.
 */
export const HealthCalculationBasisSchema = z.object({
  /** FK to amos.requirement.id; the requirement this control bridges. */
  requirement_id: z.string().uuid(),
  /** FK to public.equipment.id; the asset this control applies to. */
  asset_id: z.string().uuid(),
  /** When the calculator evaluated this row. ISO-8601. */
  evaluated_at: z.string().datetime({ offset: true }),

  inputs: z.object({
    /** FK to amos.applicability_rule.id that bound this requirement to this asset. */
    applicability_rule_id: z.string().uuid(),
    /** Snapshot of the applicability rule expression at evaluation time (jsonb shape). */
    applicability_rule_expression: z.unknown(),
    /** Fraction of required evidence present and verified. 0.0 ≤ x ≤ 1.0. */
    evidence_completeness: z.number().min(0).max(1),
    /** Active deferral status if any; null when no deferral applies. */
    deferral_state: z
      .object({
        deferral_id: z.string().uuid(),
        expiry_date: z.string().datetime({ offset: true }),
        residual_risk: z.string(),
      })
      .nullable(),
    /** amos.evidence row IDs that contributed to evidence_completeness. */
    contributing_evidence_ids: z.array(z.string().uuid()),
  }),

  computation: z.object({
    /** Calculator engine version that produced this basis (e.g. "v1.0.0"). */
    calculator_version: z.string(),
    /** Ordered decision-path tokens; OPE-132 traceability. */
    decision_path: z.array(z.string()),
    /** Short human-readable rationale; one or two sentences. */
    rationale: z.string(),
  }),
});
export type HealthCalculationBasis = z.infer<typeof HealthCalculationBasisSchema>;

// -- Internal enums (locked from CHECK constraints) --------------------

/**
 * `amos.control.control_type` CHECK vocabulary
 * (constraint `amos_control_type_valid`).
 *
 * The AMOS-derived intersection vocabulary (which of these the
 * calculator emits per intersection) is a Phase 2 disposition; this
 * enum locks the SHAPE of acceptable values.
 */
const ControlTypeEnum = z.enum(['preventive', 'detective', 'corrective', 'mitigating']);

/**
 * `amos.control.lifecycle_state` CHECK vocabulary
 * (constraint `amos_control_lifecycle_valid`).
 */
const ControlLifecycleEnum = z.enum(['active', 'superseded', 'retired']);

// -- Control health record (amos.control row shape) -------------------

/**
 * One `amos.control` row. Per James α-i: each row is one
 * (requirement, applicable-equipment) intersection at MVP1 scale
 * (~647 rows for LNGCO/LNG-DEMO at Sprint 2 close).
 *
 * The (requirement_id, asset_id) link lives inside
 * `health_calculation_basis` jsonb (HealthCalculationBasisSchema)
 * rather than as columns. This is intentional per α — no schema
 * additions; existing shape carries the relationship via provenance.
 *
 * `control_code` synthesis pattern is Phase 2 territory; this Zod
 * accepts any non-empty string.
 */
export const ControlHealthRecordSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  site_id: z.string().uuid(),

  control_code: z.string().min(1),
  control_name: z.string().min(1),
  control_description: z.string().nullable(),
  control_type: ControlTypeEnum,
  safety_critical: z.boolean(),

  /** FK to amos.risk.id; nullable per schema. */
  risk_id: z.string().uuid().nullable(),
  owner_role: z.string().min(1),
  owner_user_id: z.string().uuid().nullable(),

  /** Locked enum per HealthStatusEnum above. */
  health_status: HealthStatusEnum,
  /** When the calculator last produced this row's health value. */
  health_calculated_at: z.string().datetime({ offset: true }),
  /** OPE-132 transparency provenance; nullable on partial writes. */
  health_calculation_basis: HealthCalculationBasisSchema.nullable(),

  lifecycle_state: ControlLifecycleEnum,
  lifecycle_state_at: z.string().datetime({ offset: true }),

  created_at: z.string().datetime({ offset: true }),
  created_by: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
  updated_by: z.string().uuid(),
});
export type ControlHealthRecord = z.infer<typeof ControlHealthRecordSchema>;

// -- Control health distribution (rollup ingredient) ------------------

/**
 * Distribution of control rows by HealthStatus. Lives inside
 * `amos.assurance_score_snapshot.control_health_distribution` jsonb.
 *
 * Keys MUST be drawn from HealthStatusEnum; missing keys default to 0
 * at consumer interpretation. Values are non-negative integers.
 *
 * Example: { effective: 580, degraded: 50, failed: 17 } — 647 controls
 * total at LNGCO/LNG-DEMO MVP1 scale.
 */
export const ControlHealthDistributionSchema = z.record(HealthStatusEnum, z.number().int().nonnegative());
export type ControlHealthDistribution = z.infer<typeof ControlHealthDistributionSchema>;

// -- Assurance score snapshot (rollup row) ----------------------------

/**
 * `amos.assurance_score_snapshot.scope_type` CHECK vocabulary
 * (constraint `amos_assurance_score_scope_valid`).
 */
const AssuranceScoreScopeTypeEnum = z.enum([
  'facility',
  'system',
  'asset_class',
  'control',
  'customer',
]);

/**
 * One `amos.assurance_score_snapshot` row — a time-stamped rollup of
 * control health for a polymorphic scope.
 *
 * The 4 pre-aggregated counters (overdue_count, missing_evidence_count,
 * active_deferral_count, expired_deferral_count) map to specific
 * subsets of HealthStatusEnum and to amos.evidence /
 * amos.deferral state. D2 rollup-views authoring (Sprint 3) will
 * write rows of this shape.
 */
export const AssuranceScoreSnapshotSchema = z.object({
  id: z.string().uuid(),
  /** Snapshot time (tz-aware). */
  time: z.string().datetime({ offset: true }),
  customer_id: z.string().uuid(),
  /** Site-scoped rollups carry site_id; cross-site rollups null. */
  site_id: z.string().uuid().nullable(),

  scope_type: AssuranceScoreScopeTypeEnum,
  /** Polymorphic scope target; UUID of facility/system/asset-class/control/customer. */
  scope_id: z.string().uuid(),

  /** 0–100 scale; Phase 2/D2 rollup spec defines the formula. */
  assurance_score: z.number().min(0).max(100),
  /** Distribution of control rows in scope by HealthStatus. */
  control_health_distribution: ControlHealthDistributionSchema,

  overdue_count: z.number().int().nonnegative(),
  missing_evidence_count: z.number().int().nonnegative(),
  active_deferral_count: z.number().int().nonnegative(),
  expired_deferral_count: z.number().int().nonnegative(),

  /** Optional rollup-level provenance; D2 rollup-views authoring decides shape. */
  calculation_basis: z.unknown().nullable(),
});
export type AssuranceScoreSnapshot = z.infer<typeof AssuranceScoreSnapshotSchema>;
