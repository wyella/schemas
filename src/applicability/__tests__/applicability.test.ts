/**
 * Applicability rule expression schema tests.
 *
 * Mirrors src/parsers/__tests__/parsers.test.ts shape — node:test runner
 * against the tsc-emitted .js. Coverage per PB-AMOS-S02-D3 Phase 1.3:
 *   - good samples: each predicate variant + each composite + nested
 *   - bad samples: unknown field, missing op, depth overrun, array
 *     size overrun, type mismatches
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplicabilityRuleExpressionSchema,
  PredicateSchema,
  TextFieldSchema,
  BoolFieldSchema,
  APPLICABILITY_MAX_DEPTH,
  APPLICABILITY_MAX_ARRAY_SIZE,
  expressionDepth,
  type Expression,
} from '../index.js';

// -- Field enums --------------------------------------------------------

test('TextFieldSchema accepts equipment_class', () => {
  assert.equal(TextFieldSchema.parse('equipment_class'), 'equipment_class');
});

test('TextFieldSchema rejects unknown field', () => {
  const r = TextFieldSchema.safeParse('not_a_field');
  assert.equal(r.success, false);
});

test('BoolFieldSchema accepts safety_critical and rejects others', () => {
  assert.equal(BoolFieldSchema.parse('safety_critical'), 'safety_critical');
  assert.equal(BoolFieldSchema.safeParse('equipment_class').success, false);
});

// -- Predicate variants -------------------------------------------------

test('PredicateSchema accepts equals on a TextField', () => {
  const good = { op: 'equals' as const, field: 'equipment_class' as const, value: 'Vessel' };
  const parsed = PredicateSchema.parse(good);
  assert.deepEqual(parsed, good);
});

test('PredicateSchema rejects equals against a BoolField', () => {
  const bad = { op: 'equals', field: 'safety_critical', value: 'true' };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test('PredicateSchema accepts in with values array', () => {
  const good = { op: 'in' as const, field: 'criticality' as const, values: ['High', 'Critical'] };
  assert.deepEqual(PredicateSchema.parse(good), good);
});

test('PredicateSchema rejects in with empty values', () => {
  const bad = { op: 'in', field: 'criticality', values: [] };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test(`PredicateSchema rejects in with values exceeding ${APPLICABILITY_MAX_ARRAY_SIZE}`, () => {
  const tooMany = Array.from({ length: APPLICABILITY_MAX_ARRAY_SIZE + 1 }, (_, i) => `v${i}`);
  const bad = { op: 'in', field: 'equipment_class', values: tooMany };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test('PredicateSchema accepts matches with a regex pattern', () => {
  const good = { op: 'matches' as const, field: 'area' as const, pattern: '^Liquefaction$' };
  assert.deepEqual(PredicateSchema.parse(good), good);
});

test('PredicateSchema rejects matches with empty pattern', () => {
  const bad = { op: 'matches', field: 'area', pattern: '' };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test('PredicateSchema accepts equals_bool on safety_critical', () => {
  const good = { op: 'equals_bool' as const, field: 'safety_critical' as const, value: true };
  assert.deepEqual(PredicateSchema.parse(good), good);
});

test('PredicateSchema rejects equals_bool against a TextField', () => {
  const bad = { op: 'equals_bool', field: 'equipment_class', value: true };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test('PredicateSchema rejects equals_bool with non-boolean value', () => {
  const bad = { op: 'equals_bool', field: 'safety_critical', value: 'true' };
  assert.equal(PredicateSchema.safeParse(bad).success, false);
});

test('PredicateSchema accepts the all shortcut', () => {
  const good = { op: 'all' as const };
  assert.deepEqual(PredicateSchema.parse(good), good);
});

// -- Composites ---------------------------------------------------------

test('ApplicabilityRuleExpressionSchema accepts and(equals, equals_bool)', () => {
  const good: Expression = {
    op: 'and',
    clauses: [
      { op: 'equals', field: 'equipment_class', value: 'Vessel' },
      { op: 'equals_bool', field: 'safety_critical', value: true },
    ],
  };
  const parsed = ApplicabilityRuleExpressionSchema.parse(good);
  assert.deepEqual(parsed, good);
});

test('ApplicabilityRuleExpressionSchema accepts or(in, all)', () => {
  const good: Expression = {
    op: 'or',
    clauses: [
      { op: 'in', field: 'area', values: ['Liquefaction', 'Utilities'] },
      { op: 'all' },
    ],
  };
  assert.deepEqual(ApplicabilityRuleExpressionSchema.parse(good), good);
});

test('ApplicabilityRuleExpressionSchema accepts not(equals)', () => {
  const good: Expression = {
    op: 'not',
    clause: { op: 'equals', field: 'criticality', value: 'Medium' },
  };
  assert.deepEqual(ApplicabilityRuleExpressionSchema.parse(good), good);
});

test('ApplicabilityRuleExpressionSchema accepts deeply nested expression up to MAX_DEPTH', () => {
  // Build a not(not(not(not(not(equals))))) chain — depth 6 (5 nots + 1 leaf).
  let expr: Expression = { op: 'equals', field: 'equipment_class', value: 'Pump' };
  for (let i = 0; i < APPLICABILITY_MAX_DEPTH - 1; i += 1) {
    expr = { op: 'not', clause: expr };
  }
  assert.equal(expressionDepth(expr), APPLICABILITY_MAX_DEPTH);
  const parsed = ApplicabilityRuleExpressionSchema.parse(expr);
  assert.equal(expressionDepth(parsed), APPLICABILITY_MAX_DEPTH);
});

test(`ApplicabilityRuleExpressionSchema rejects expression deeper than ${APPLICABILITY_MAX_DEPTH}`, () => {
  // depth = MAX + 1
  let expr: Expression = { op: 'equals', field: 'equipment_class', value: 'Pump' };
  for (let i = 0; i < APPLICABILITY_MAX_DEPTH; i += 1) {
    expr = { op: 'not', clause: expr };
  }
  assert.equal(expressionDepth(expr), APPLICABILITY_MAX_DEPTH + 1);
  const r = ApplicabilityRuleExpressionSchema.safeParse(expr);
  assert.equal(r.success, false);
  if (!r.success) {
    assert.ok(r.error.issues.some((i) => /nesting depth/i.test(i.message)));
  }
});

test(`ApplicabilityRuleExpressionSchema rejects and-clauses array > ${APPLICABILITY_MAX_ARRAY_SIZE}`, () => {
  const tooMany: Expression[] = Array.from({ length: APPLICABILITY_MAX_ARRAY_SIZE + 1 }, (_, i) => ({
    op: 'equals' as const, field: 'equipment_class' as const, value: `Class${i}`,
  }));
  const bad: Expression = { op: 'and', clauses: tooMany };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

test('ApplicabilityRuleExpressionSchema rejects unknown op', () => {
  const bad = { op: 'gte', field: 'criticality', value: 'High' };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

test('ApplicabilityRuleExpressionSchema rejects expression missing op', () => {
  const bad = { field: 'equipment_class', value: 'Vessel' };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

test('ApplicabilityRuleExpressionSchema rejects unknown field on equals', () => {
  const bad = { op: 'equals', field: 'manufacturer', value: 'X' };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

test('ApplicabilityRuleExpressionSchema rejects equals with numeric value', () => {
  const bad = { op: 'equals', field: 'criticality', value: 1 };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

test('ApplicabilityRuleExpressionSchema rejects empty and clauses', () => {
  const bad = { op: 'and', clauses: [] };
  assert.equal(ApplicabilityRuleExpressionSchema.safeParse(bad).success, false);
});

// -- expressionDepth helper sanity checks -------------------------------

test('expressionDepth returns 1 for a leaf predicate', () => {
  assert.equal(expressionDepth({ op: 'all' }), 1);
  assert.equal(expressionDepth({ op: 'equals', field: 'equipment_class', value: 'Vessel' }), 1);
});

test('expressionDepth returns 2 for and(leaf,leaf)', () => {
  const e: Expression = {
    op: 'and',
    clauses: [
      { op: 'equals', field: 'criticality', value: 'High' },
      { op: 'all' },
    ],
  };
  assert.equal(expressionDepth(e), 2);
});

test('expressionDepth returns max + 1 for nested composites', () => {
  // not(and(equals, or(equals_bool, all)))
  const e: Expression = {
    op: 'not',
    clause: {
      op: 'and',
      clauses: [
        { op: 'equals', field: 'area', value: 'Liquefaction' },
        {
          op: 'or',
          clauses: [
            { op: 'equals_bool', field: 'safety_critical', value: true },
            { op: 'all' },
          ],
        },
      ],
    },
  };
  // not (1) + and (1) + or (1) + leaf (1) = 4
  assert.equal(expressionDepth(e), 4);
});
