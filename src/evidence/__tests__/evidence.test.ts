/**
 * Evidence record schema tests.
 *
 * Mirrors src/applicability/__tests__/applicability.test.ts shape —
 * node:test runner against tsc-emitted .js. Coverage:
 *   - EvidenceTypeEnum accepts any non-empty string (open vocabulary)
 *     and rejects empty/non-string
 *   - EvidenceRecordSchema accepts a populated row + rejects
 *     unknown verification_status / lifecycle_state
 *   - KNOWN_EVIDENCE_TYPES list is non-empty (documentation guarantee)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceTypeEnum,
  EvidenceRecordSchema,
  KNOWN_EVIDENCE_TYPES,
} from '../index.js';

const UUID = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';
const UUID3 = '00000000-0000-4000-8000-000000000003';
const ISO = '2026-05-09T12:00:00.000Z';

// -- EvidenceTypeEnum (open / branded) --------------------------------

test('EvidenceTypeEnum accepts a known type', () => {
  const r = EvidenceTypeEnum.safeParse('inspection_report');
  assert.equal(r.success, true);
});

test('EvidenceTypeEnum accepts a novel (unknown) type — open vocabulary', () => {
  const r = EvidenceTypeEnum.safeParse('drone_thermal_scan_v2');
  assert.equal(r.success, true);
});

test('EvidenceTypeEnum rejects empty string', () => {
  assert.equal(EvidenceTypeEnum.safeParse('').success, false);
});

test('EvidenceTypeEnum rejects non-string', () => {
  assert.equal(EvidenceTypeEnum.safeParse(42).success, false);
});

test('KNOWN_EVIDENCE_TYPES is non-empty and contains canonical types', () => {
  assert.ok(KNOWN_EVIDENCE_TYPES.length > 0);
  assert.ok(KNOWN_EVIDENCE_TYPES.includes('inspection_report'));
  assert.ok(KNOWN_EVIDENCE_TYPES.includes('audit_log'));
});

// -- EvidenceRecordSchema ---------------------------------------------

const validEvidence = {
  id: UUID,
  customer_id: UUID2,
  site_id: UUID3,
  evidence_code: 'EV-INSP-PUMP-0001',
  evidence_type: 'inspection_report',
  asset_id: UUID,
  work_order_id: null,
  requirement_id: UUID2,
  file_reference: 'blob://amos/insp/2026-05-01.pdf',
  file_hash: 'sha256:abcdef',
  evidence_date: ISO,
  evidence_metadata: { inspector: 'mtech-09', shift: 'A' },
  verification_status: 'verified',
  verified_by: UUID3,
  verification_date: ISO,
  verification_notes: 'All pass.',
  lifecycle_state: 'active',
  lifecycle_state_at: ISO,
  created_at: ISO,
  created_by: UUID,
  updated_at: ISO,
  updated_by: UUID,
};

test('EvidenceRecordSchema accepts populated row', () => {
  assert.equal(EvidenceRecordSchema.safeParse(validEvidence).success, true);
});

test('EvidenceRecordSchema accepts null work_order_id', () => {
  const e = { ...validEvidence, work_order_id: null };
  assert.equal(EvidenceRecordSchema.safeParse(e).success, true);
});

test('EvidenceRecordSchema accepts pending verification (no verifier)', () => {
  const e = { ...validEvidence, verification_status: 'pending', verified_by: null, verification_date: null };
  assert.equal(EvidenceRecordSchema.safeParse(e).success, true);
});

test('EvidenceRecordSchema rejects unknown verification_status', () => {
  const e = { ...validEvidence, verification_status: 'maybe' };
  assert.equal(EvidenceRecordSchema.safeParse(e).success, false);
});

test('EvidenceRecordSchema rejects unknown lifecycle_state', () => {
  const e = { ...validEvidence, lifecycle_state: 'archived' };
  assert.equal(EvidenceRecordSchema.safeParse(e).success, false);
});

test('EvidenceRecordSchema rejects empty evidence_type', () => {
  const e = { ...validEvidence, evidence_type: '' };
  assert.equal(EvidenceRecordSchema.safeParse(e).success, false);
});
