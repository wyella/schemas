/**
 * Control health + assurance rollup schema tests.
 *
 * Mirrors src/applicability/__tests__/applicability.test.ts shape —
 * node:test runner against tsc-emitted .js. Coverage:
 *   - HealthStatusEnum vocabulary (6 values + rejection of unknown)
 *   - HealthCalculationBasisSchema shape (deferral_state nullable;
 *     evidence_completeness range; contributing_evidence_ids array)
 *   - ControlHealthRecordSchema accepts a populated row + rejects
 *     an unknown health_status
 *   - ControlHealthDistributionSchema accepts the 6-key shape +
 *     rejects unknown keys + rejects negative counts
 *   - AssuranceScoreSnapshotSchema accepts a populated row + rejects
 *     out-of-range assurance_score
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HealthStatusEnum,
  HealthCalculationBasisSchema,
  ControlHealthRecordSchema,
  ControlHealthDistributionSchema,
  AssuranceScoreSnapshotSchema,
} from '../index.js';

const UUID = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';
const UUID3 = '00000000-0000-4000-8000-000000000003';
const ISO = '2026-05-09T12:00:00.000Z';

// -- HealthStatusEnum --------------------------------------------------

test('HealthStatusEnum accepts all 6 locked values', () => {
  for (const v of ['effective', 'degraded', 'failed', 'unknown', 'deferred', 'overdue']) {
    assert.equal(HealthStatusEnum.parse(v), v);
  }
});

test('HealthStatusEnum rejects unknown value', () => {
  assert.equal(HealthStatusEnum.safeParse('healthy').success, false);
});

// -- HealthCalculationBasisSchema -------------------------------------

const validBasis = {
  requirement_id: UUID,
  asset_id: UUID2,
  evaluated_at: ISO,
  inputs: {
    applicability_rule_id: UUID3,
    applicability_rule_expression: { op: 'all' },
    evidence_completeness: 0.75,
    deferral_state: null,
    contributing_evidence_ids: [UUID, UUID2],
  },
  computation: {
    calculator_version: 'v1.0.0',
    decision_path: ['rule:matched', 'evidence:partial', 'status:degraded'],
    rationale: 'Partial evidence (3 of 4 required types) — degraded.',
  },
};

test('HealthCalculationBasisSchema accepts populated basis', () => {
  assert.equal(HealthCalculationBasisSchema.safeParse(validBasis).success, true);
});

test('HealthCalculationBasisSchema accepts non-null deferral_state', () => {
  const b = {
    ...validBasis,
    inputs: {
      ...validBasis.inputs,
      deferral_state: { deferral_id: UUID, expiry_date: ISO, residual_risk: 'medium' },
    },
  };
  assert.equal(HealthCalculationBasisSchema.safeParse(b).success, true);
});

test('HealthCalculationBasisSchema rejects evidence_completeness > 1', () => {
  const b = { ...validBasis, inputs: { ...validBasis.inputs, evidence_completeness: 1.5 } };
  assert.equal(HealthCalculationBasisSchema.safeParse(b).success, false);
});

test('HealthCalculationBasisSchema rejects evidence_completeness < 0', () => {
  const b = { ...validBasis, inputs: { ...validBasis.inputs, evidence_completeness: -0.1 } };
  assert.equal(HealthCalculationBasisSchema.safeParse(b).success, false);
});

// -- ControlHealthRecordSchema ----------------------------------------

const validControl = {
  id: UUID,
  customer_id: UUID2,
  site_id: UUID3,
  control_code: 'CTRL-INSP-PUMP-018-EQ-0001',
  control_name: 'Pump weekly visual inspection',
  control_description: 'Weekly visual inspection per REQ-PRD-INSP-EX-018.',
  control_type: 'preventive',
  safety_critical: true,
  risk_id: null,
  owner_role: 'maintenance_supervisor',
  owner_user_id: null,
  health_status: 'effective',
  health_calculated_at: ISO,
  health_calculation_basis: validBasis,
  lifecycle_state: 'active',
  lifecycle_state_at: ISO,
  created_at: ISO,
  created_by: UUID,
  updated_at: ISO,
  updated_by: UUID,
};

test('ControlHealthRecordSchema accepts populated row', () => {
  assert.equal(ControlHealthRecordSchema.safeParse(validControl).success, true);
});

test('ControlHealthRecordSchema rejects unknown health_status', () => {
  const c = { ...validControl, health_status: 'healthy' };
  assert.equal(ControlHealthRecordSchema.safeParse(c).success, false);
});

test('ControlHealthRecordSchema accepts null health_calculation_basis', () => {
  const c = { ...validControl, health_calculation_basis: null };
  assert.equal(ControlHealthRecordSchema.safeParse(c).success, true);
});

test('ControlHealthRecordSchema rejects unknown control_type', () => {
  const c = { ...validControl, control_type: 'novel' };
  assert.equal(ControlHealthRecordSchema.safeParse(c).success, false);
});

// -- ControlHealthDistributionSchema ----------------------------------

test('ControlHealthDistributionSchema accepts 6-key shape', () => {
  const d = { effective: 580, degraded: 50, failed: 17, unknown: 0, deferred: 0, overdue: 0 };
  assert.equal(ControlHealthDistributionSchema.safeParse(d).success, true);
});

test('ControlHealthDistributionSchema accepts partial keys (z.record default)', () => {
  // z.record() does not require all keys; consumer interprets missing as 0
  const d = { effective: 600, degraded: 47 };
  assert.equal(ControlHealthDistributionSchema.safeParse(d).success, true);
});

test('ControlHealthDistributionSchema rejects unknown key', () => {
  const d = { effective: 600, healthy: 47 };
  assert.equal(ControlHealthDistributionSchema.safeParse(d).success, false);
});

test('ControlHealthDistributionSchema rejects negative count', () => {
  const d = { effective: -1 };
  assert.equal(ControlHealthDistributionSchema.safeParse(d).success, false);
});

test('ControlHealthDistributionSchema rejects non-integer count', () => {
  const d = { effective: 1.5 };
  assert.equal(ControlHealthDistributionSchema.safeParse(d).success, false);
});

// -- AssuranceScoreSnapshotSchema -------------------------------------

const validSnapshot = {
  id: UUID,
  time: ISO,
  customer_id: UUID2,
  site_id: UUID3,
  scope_type: 'facility',
  scope_id: UUID,
  assurance_score: 87.5,
  control_health_distribution: { effective: 580, degraded: 50, failed: 17 },
  overdue_count: 12,
  missing_evidence_count: 5,
  active_deferral_count: 3,
  expired_deferral_count: 1,
  calculation_basis: null,
};

test('AssuranceScoreSnapshotSchema accepts populated row', () => {
  assert.equal(AssuranceScoreSnapshotSchema.safeParse(validSnapshot).success, true);
});

test('AssuranceScoreSnapshotSchema accepts null site_id (cross-site rollup)', () => {
  const s = { ...validSnapshot, site_id: null };
  assert.equal(AssuranceScoreSnapshotSchema.safeParse(s).success, true);
});

test('AssuranceScoreSnapshotSchema rejects assurance_score > 100', () => {
  const s = { ...validSnapshot, assurance_score: 101 };
  assert.equal(AssuranceScoreSnapshotSchema.safeParse(s).success, false);
});

test('AssuranceScoreSnapshotSchema rejects assurance_score < 0', () => {
  const s = { ...validSnapshot, assurance_score: -1 };
  assert.equal(AssuranceScoreSnapshotSchema.safeParse(s).success, false);
});

test('AssuranceScoreSnapshotSchema rejects unknown scope_type', () => {
  const s = { ...validSnapshot, scope_type: 'site' };
  assert.equal(AssuranceScoreSnapshotSchema.safeParse(s).success, false);
});
