/**
 * @wyella/schemas — shared Zod primitives substrate.
 *
 * Sprint 0 D2 (PB-AMOS-002, OPE-139). Empty namespace shell. AMOS is the
 * first canonical consumer; future schema packages (`@wyella/cpil-schema`,
 * `@wyella/oeil-schema`, ...) follow the same re-export pattern as the
 * platform-wide consolidation proceeds.
 *
 * The architectural commitment to Zod-as-source-of-truth (WS-C intent) is
 * honoured for AMOS without requiring retro-fit of the existing 28+ repos
 * that validate inline.
 *
 * Population begins in Sprint 1 as AMOS schema lands.
 */

import { z } from 'zod';

/** Re-exported Zod for downstream consumer convenience. */
export { z };

/** Package metadata constant; useful for runtime version assertions. */
export const SCHEMAS_VERSION = '0.0.1' as const;

// Future shape — populated in Sprint 1+ as AMOS-then-other-verticals expose
// shared primitives:
//
//   export * from './primitives/index.js';     // Uuid, Email, IsoDate, ...
//   export * from './tenant/index.js';         // CustomerId, SiteId, RoleCode, ...
//   export * from './audit/index.js';          // AuditEvent, ActorContext, ...
