/**
 * Applicability rule expression schema for AMOS requirements.
 *
 * Producer: wyella/amos UI rule editor (PATCH/POST /requirement/:id/
 * applicability) — body field `expression` validates against
 * ApplicabilityRuleExpression at the engine route boundary.
 * Consumer: wyella/amos-engine route handlers persist the validated
 * shape into `amos.applicability_rule.rule_expression` (JSONB) and the
 * PL/pgSQL `amos.amos_applicability_rule_matches(expr, equip)` evaluator
 * traverses the same shape against `amos.v_equipment` rows.
 *
 * Subordinate to PB-AMOS-S02-D3-APPLICABILITY-RULES — DISPOSITIONED
 * (DP-1..DP-8). Grammar field set + boolean op extension confirmed via
 * live-DB probe of public.equipment column distribution under
 * tenant LNGCO/LNG-DEMO (197 rows, 2026-05-08).
 *
 * The grammar is intentionally narrow: closed-loop comparator (OPE-132)
 * is the consumer; rules are evaluated in PL/pgSQL on each matview
 * refresh; the surface area is the operator-facing rule editor. Future
 * extensions (range ops, JSON-path, computed fields) defer to OPE-152
 * architectural amendment.
 */
import { z } from 'zod';

/** Maximum nesting depth of an Expression tree (DP-4). */
export const APPLICABILITY_MAX_DEPTH = 6;
/** Maximum length of a clauses[] or values[] array (DP-4). */
export const APPLICABILITY_MAX_ARRAY_SIZE = 50;

/**
 * Text-typed equipment fields the grammar can filter on.
 * Confirmed via live-DB probe (PB-AMOS-S02-D3 §A):
 *   equipment_class — 32 distinct values (Vessel, Pump, ...)
 *   area            — 15 distinct values (Liquefaction, Utilities, ...)
 *   criticality     — 3 values (High, Medium, Critical)
 *   operational_status — 1 value live (IN_SERVICE) but reserved for
 *     future multi-value once equipment lifecycle expands.
 */
export const TextFieldSchema = z.enum([
  'equipment_class',
  'area',
  'criticality',
  'operational_status',
]);
export type TextField = z.infer<typeof TextFieldSchema>;

/**
 * Boolean-typed equipment fields. Currently a singleton; reserved as
 * an enum so future boolean fields (e.g. instrument_protected,
 * regulated_under_oogo, ...) extend without grammar churn.
 */
export const BoolFieldSchema = z.enum(['safety_critical']);
export type BoolField = z.infer<typeof BoolFieldSchema>;

/**
 * Predicate — a leaf expression that evaluates against a single
 * equipment row. The `all` predicate is a tenant-scope shortcut; it
 * matches every equipment row visible under the rule's customer scope.
 */
export const PredicateSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('equals'),
    field: TextFieldSchema,
    value: z.string(),
  }),
  z.object({
    op: z.literal('in'),
    field: TextFieldSchema,
    values: z.array(z.string()).min(1).max(APPLICABILITY_MAX_ARRAY_SIZE),
  }),
  z.object({
    op: z.literal('matches'),
    field: TextFieldSchema,
    pattern: z.string().min(1),
  }),
  z.object({
    op: z.literal('equals_bool'),
    field: BoolFieldSchema,
    value: z.boolean(),
  }),
  z.object({ op: z.literal('all') }),
]);
export type Predicate = z.infer<typeof PredicateSchema>;

/**
 * Expression — recursive composite over Predicate. Uses z.lazy() to
 * permit the recursive shape; the explicit TypeScript type below is
 * needed for inference to stay correct under recursion.
 */
export type Expression =
  | Predicate
  | { op: 'and'; clauses: Expression[] }
  | { op: 'or';  clauses: Expression[] }
  | { op: 'not'; clause:  Expression };

const ExpressionBaseSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    PredicateSchema,
    z.object({
      op: z.literal('and'),
      clauses: z.array(ExpressionBaseSchema).min(1).max(APPLICABILITY_MAX_ARRAY_SIZE),
    }),
    z.object({
      op: z.literal('or'),
      clauses: z.array(ExpressionBaseSchema).min(1).max(APPLICABILITY_MAX_ARRAY_SIZE),
    }),
    z.object({
      op: z.literal('not'),
      clause: ExpressionBaseSchema,
    }),
  ]),
);

/**
 * Compute the nesting depth of an Expression tree. A leaf predicate
 * has depth 1; each composite layer adds 1.
 *
 *   equals                   → 1
 *   and([equals, equals])    → 2
 *   not(and([equals]))       → 3
 */
export function expressionDepth(expr: Expression): number {
  if (expr.op === 'and' || expr.op === 'or') {
    return 1 + (expr.clauses.length === 0 ? 0 : Math.max(...expr.clauses.map(expressionDepth)));
  }
  if (expr.op === 'not') {
    return 1 + expressionDepth(expr.clause);
  }
  return 1;
}

/**
 * Canonical schema export. Composes the recursive shape with a
 * top-level depth-limit refinement (Zod can enforce array sizes at
 * each node but cannot natively limit recursion depth).
 *
 * Consumers (amos-engine route handlers) should call:
 *   ApplicabilityRuleExpressionSchema.safeParse(body.expression)
 * and surface zod issues verbatim on parse failure (422 with
 * structured issue list).
 */
export const ApplicabilityRuleExpressionSchema = ExpressionBaseSchema.superRefine((expr, ctx) => {
  const d = expressionDepth(expr);
  if (d > APPLICABILITY_MAX_DEPTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expression nesting depth ${d} exceeds maximum ${APPLICABILITY_MAX_DEPTH}`,
      path: [],
    });
  }
});

/** Type alias for downstream consumers; equivalent to `Expression`. */
export type ApplicabilityRuleExpression = Expression;
