# @wyella/schemas

**Purpose.** Shared Zod schemas substrate for the Wyella platform. Honours the WS-C intent of Zod-as-source-of-truth in a single shared package, decoupled from any specific app's schema concerns.

**Status.** Populated 2026-05-06 with the canonical parsers types extracted from `wyella/amos-engine` per OPE-150 sub-finding (w). PB-AMOS-S02-D3 (2026-05-08) added the applicability rule expression grammar consumed by the AMOS rule editor + engine route handlers + the PL/pgSQL matview evaluator. Cross-repo consumption mechanism: git-URL dependency tracking `main`, per OPE-153.

**Authority.** OPE-139 (package shell created Sprint 0); OPE-153 (cross-repo consumption mechanism, James-authorised 2026-05-06: dedicated repo, main-branch tracking).

## Current exports

```ts
import {
  // Parsers (Sprint 1 D5.1)
  ParserFormatSchema,
  ParsedSectionSchema,
  ParsedTableSchema,
  ParsedDocumentSchema,
  ParserFormat,
  ParsedSection,
  ParsedTable,
  ParsedDocument,
  // Applicability (Sprint 2 D3)
  ApplicabilityRuleExpressionSchema,
  PredicateSchema,
  TextFieldSchema,
  BoolFieldSchema,
  ApplicabilityRuleExpression,
  Expression,
  Predicate,
  TextField,
  BoolField,
  expressionDepth,
  APPLICABILITY_MAX_DEPTH,
  APPLICABILITY_MAX_ARRAY_SIZE,
  // Conveniences
  z,
  SCHEMAS_VERSION,
} from '@wyella/schemas';
```

The **parsers** types describe the JSON shape produced by AMOS procedure ingestion (DOCX + PDF) and consumed by AMOS extraction. The shape is a 1:1 mirror of the prior in-engine TypeScript types — no Zod refinements have been applied. Refinements (e.g. `level: z.number().int().min(1).max(6)`) are deferred to a separate decision once parser invariants firm up in production.

The **applicability** types describe the rule grammar AMOS operators author through the rule editor and which the PL/pgSQL `amos_applicability_rule_matches(expr, equip)` evaluator traverses against `amos.v_equipment` rows. Predicates (`equals`, `in`, `matches`, `equals_bool`, `all`) compose under `and` / `or` / `not` up to `APPLICABILITY_MAX_DEPTH` levels of nesting and `APPLICABILITY_MAX_ARRAY_SIZE` clauses or values per node. The grammar field set is probe-confirmed against `public.equipment` (DP-4): `equipment_class`, `area`, `criticality`, `operational_status` for text predicates; `safety_critical` for the boolean predicate. Future field additions extend the relevant enum and the PL/pgSQL evaluator branch in lockstep.

## Cross-repo consumption

Consumer `package.json`:

```json
{
  "dependencies": {
    "@wyella/schemas": "github:wyella/schemas#main"
  }
}
```

**Main-branch tracking.** Each merge to `main` here reaches all consumers on next `npm install`. Revisit pinning style at the third cross-repo consumer per OPE-153 sub-finding.

Consumers run `npm install` at build time; npm clones the repo via git+HTTPS (or SSH if configured). The `prepare` script in this package's `package.json` runs `tsc` after install so the `dist/` directory is populated for type resolution and runtime imports.

## Why this exists

`PB-AMOS-001` confirmed `@wyella/schemas` did not exist as a workspace package — zero hits across all `package.json` files in the workspace at audit time. Apps that validate at all do so with inline Zod, contradicting the WS-C intent. AMOS needed shared API surface schemas regardless; if AMOS authored them inline, the architectural commitment would have been further diluted.

Sprint 1 surfaced the cost of inline-only types: `amos-extraction` had its own `interface ParsedSection { heading?: string; text?: string }` declaration that drifted from the canonical `s.body_md` field name in `amos-engine`, silently dropping 97% of body content from production extraction (Failure Mode 6). PB-AMOS-S02-D5-1-IMPL closed that drift class architecturally — both producer and consumer now import from this package; local re-declaration is CI-rejected per-consumer.

## Layout

```
src/
  index.ts                 Public entry; re-exports from sub-modules
  parsers/
    index.ts               ParserFormat / ParsedSection / ParsedTable / ParsedDocument
    __tests__/
      parsers.test.ts      Good + bad samples; phantom-field strip test
  applicability/
    index.ts               ApplicabilityRuleExpression grammar (predicates + composites)
    __tests__/
      applicability.test.ts  Predicate variants, composites, depth + array-size bounds
  primitives/              (future) Uuid, Email, IsoDate, NonEmptyString, ...
  tenant/                  (future) CustomerId, SiteId, RoleCode, ...
  audit/                   (future) AuditEvent, ActorContext, ...
dist/                      Compiled output (gitignored; emitted by tsc)
package.json
tsconfig.json
README.md
```

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm install`, `npm run lint`, `npm run typecheck`, and `npm test` on every push to `main` and every pull request.

## Provenance

This repository was created by extracting `wyella/platform-db/packages/schemas/` via `git filter-repo --path packages/schemas/ --path-rename packages/schemas/:` and pushing the rebased single-commit history as the initial `main`. The commit titled "feat(packages/schemas): @wyella/schemas package shell (Sprint 0 D2; OPE-139)" remains the original Sprint 0 D2 commit, preserved for governance traceability.

The corresponding directory was removed from `wyella/platform-db` in commit `chore: remove @wyella/schemas workspace package (relocated to wyella/schemas repo)` shipped in the same chain-execution turn as this repository's population.
