/**
 * Evidence record schemas for the AMOS calculator.
 *
 * Producer: wyella/amos UI evidence-upload flow (Sprint 4) writes rows
 * to `amos.evidence`. Consumer: wyella/amos-engine calculator reads
 * evidence rows when computing `evidence_completeness` for each
 * (requirement, asset) intersection.
 *
 * Subordinate to PB-AMOS-S03-D1-PHASE1 — calculator I/O types. Schema
 * shape lifted verbatim from production via PB-AMOS-S03-D1 Phase 0
 * probe report §5 (2026-05-09); enum vocabularies locked from CHECK
 * constraints surfaced by Phase 1 vocabulary probe.
 */
import { z } from 'zod';

// -- Evidence type (open vocabulary, branded) -------------------------

/**
 * Brand applied to evidence_type strings.
 *
 * NO CHECK constraint exists on `amos.evidence.evidence_type` in
 * production (verified via Phase 1 vocabulary probe). The 30 evidence
 * types observed in `amos.requirement.evidence_types[]` (per Phase 0
 * probe report §5) represent IN-USE vocabulary, not ENFORCED
 * vocabulary. SME-authored or AI-extracted requirements may introduce
 * a 31st type.
 *
 * Branding chosen over closed `z.enum([...])` so the type system
 * recognises evidence_type values as a distinct subtype of string
 * without rejecting future additions. Consumers who need type-narrowed
 * dispatch should use the in-use list KNOWN_EVIDENCE_TYPES (below) as
 * a recommendation, not as a constraint.
 */
declare const evidenceTypeBrand: unique symbol;
export type EvidenceType = string & { readonly [evidenceTypeBrand]: true };

/**
 * Open-vocabulary brand: any non-empty string is accepted at the
 * boundary. Consumer applications may impose tighter validation
 * (e.g. an admin tool that only allows known values) by composing
 * EvidenceTypeEnum with a stricter refine() at their boundary.
 */
export const EvidenceTypeEnum = z
  .string()
  .min(1, { message: 'evidence_type must be non-empty' })
  .transform((v) => v as EvidenceType);

/**
 * The 30 evidence types observed in production at Sprint 2 close
 * (per Phase 0 probe report §5). Provided as a documentation-grade
 * recommendation set; consumers may use this list to seed UI
 * pickers or to author CHECK constraints in future schema sprints.
 *
 * Order mirrors descending frequency in `amos.requirement.evidence_types`
 * unnest at the time of probing.
 */
export const KNOWN_EVIDENCE_TYPES = [
  'requirement_register_entry',
  'audit_log',
  'approval_record',
  'deferral_record',
  'work_order_record',
  'asset_register_entry',
  'relationship_map',
  'data_quality_report',
  'control_register_entry',
  'calibration_record',
  'test_certificate',
  'verification_record',
  'defect_record',
  'ai_response_record',
  'audit_pack',
  'acceptance_test_record',
  'access_control_record',
  'inspection_report',
  'impact_assessment',
  'escalation_log',
  'photograph',
  'engineering_basis_record',
  'lifecycle_record',
  'evidence_review_record',
  'control_health_report',
  'moc_record',
  'review_record',
  'evidence_link',
  'acceptance_result',
  'trend_report',
] as const;

// -- Internal enums (locked from CHECK constraints) -------------------

/**
 * `amos.evidence.verification_status` CHECK vocabulary
 * (constraint `amos_evidence_verification_valid`).
 */
const EvidenceVerificationStatusEnum = z.enum(['verified', 'pending', 'rejected', 'missing']);

/**
 * `amos.evidence.lifecycle_state` CHECK vocabulary
 * (constraint `amos_evidence_lifecycle_valid`).
 */
const EvidenceLifecycleEnum = z.enum(['active', 'superseded', 'retired']);

// -- Evidence record (amos.evidence row shape) ------------------------

/**
 * One `amos.evidence` row. Per Phase 0 probe report §5: 22 columns,
 * 5 FK constraints (customer, site, requirement, created_by, updated_by).
 * `asset_id` references public.equipment.id; `work_order_id` is
 * nullable (Sprint 4 work-order subsystem will populate).
 *
 * `verification_status` and `lifecycle_state` carry CHECK-constrained
 * vocabularies; both are inlined here as internal enums to keep the
 * directive's "7 named exports" count clean.
 */
export const EvidenceRecordSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  site_id: z.string().uuid(),

  evidence_code: z.string().min(1),
  evidence_type: EvidenceTypeEnum,

  /** FK to public.equipment.id; the asset this evidence supports. */
  asset_id: z.string().uuid(),
  /** FK to a work-order subsystem (Sprint 4); nullable. */
  work_order_id: z.string().uuid().nullable(),
  /** FK to amos.requirement.id; the requirement this evidence proves. */
  requirement_id: z.string().uuid(),

  file_reference: z.string().nullable(),
  file_hash: z.string().nullable(),
  evidence_date: z.string().datetime({ offset: true }).nullable(),
  evidence_metadata: z.unknown().nullable(),

  verification_status: EvidenceVerificationStatusEnum,
  verified_by: z.string().uuid().nullable(),
  verification_date: z.string().datetime({ offset: true }).nullable(),
  verification_notes: z.string().nullable(),

  lifecycle_state: EvidenceLifecycleEnum,
  lifecycle_state_at: z.string().datetime({ offset: true }),

  created_at: z.string().datetime({ offset: true }),
  created_by: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
  updated_by: z.string().uuid(),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
