# @wyella/schemas

**Purpose.** The shared Zod primitives substrate for the Wyella platform. Honours the WS-C intent of Zod-as-source-of-truth in a single shared package, decoupled from any specific app's schema concerns.

**Status.** Sprint 0 D2 shell — empty namespace, ready for population. AMOS is the first canonical consumer.

**Authority.** OPE-139 (`@wyella/schemas` package shell created in Sprint 0; AMOS first canonical consumer).

## Why this exists

PB-AMOS-001 confirmed that `@wyella/schemas` did not exist as a workspace package — zero hits across all `package.json` files in the workspace at audit time. Apps that validate at all do so with inline Zod, contradicting the WS-C intent. AMOS needed shared API surface schemas regardless; if AMOS authored them inline, the architectural commitment would have been further diluted.

Building the shell in Sprint 0 with AMOS as first canonical consumer costs minimal additional effort, preserves the architectural commitment, and provides the structural seed for future consolidation. Existing 28+ repos are not retro-fitted; they will adopt as part of the broader platform RLS / schema-housekeeping workstream alongside the other PB-AMOS-001 blockers.

## Layout

```
src/
  index.ts                 Public entry; re-exports from sub-modules
  primitives/              (future) Uuid, Email, IsoDate, NonEmptyString, ...
  tenant/                  (future) CustomerId, SiteId, RoleCode, ...
  audit/                   (future) AuditEvent, ActorContext, ...
dist/                      Compiled output (gitignored; published from CI)
package.json
tsconfig.json
README.md
```

## Workspace placement

This package lives in the `wyella/platform-db` repo's `packages/*` workspace. Reasons:
- pdb is the substrate-mature repo with the operational discipline (Sentry, RLS housekeeping, migrations) needed to host a shared package
- Co-locating shared primitives with the platform's authoritative schema authority (post DEC-921a) keeps cross-cuts close
- npm workspaces resolve `@wyella/schemas` automatically for any future `packages/*` siblings

When the consolidation workstream begins, this package may relocate to a dedicated `wyella/schemas` repo. The migration is mechanical; the package shape is correct from day one.

## Consumer pattern (post-publish)

```ts
// In any consumer:
import { z, SCHEMAS_VERSION } from '@wyella/schemas';
// Future: import { CustomerId, AuditEvent } from '@wyella/schemas';
```

`@wyella/amos-schema` (in `wyella/amos-schema`) declares dependency on this package and re-exports shared primitives alongside its AMOS-specific schemas.
