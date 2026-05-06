/**
 * @wyella/schemas — shared Zod schemas substrate.
 *
 * Sprint 0 D2 shell created the package; PB-AMOS-S02-D5-1-IMPL
 * (2026-05-06) populated the first canonical types (parsers/) and
 * relocated the package from platform-db's workspace into a dedicated
 * cross-repo dependency at github.com/wyella/schemas.
 *
 * Subordinate to OPE-139 (package shell) and OPE-153 (cross-repo
 * consumption mechanism). AMOS is the first canonical consumer.
 *
 * Consumption pattern (consumer package.json):
 *
 *   "@wyella/schemas": "github:wyella/schemas#main"
 *
 * Main-branch tracking: each merge here reaches all consumers on next
 * install. Revisit pinning style at the third cross-repo consumer
 * per OPE-153 sub-finding.
 */

import { z } from 'zod';

/** Re-exported Zod for downstream consumer convenience. */
export { z };

/** Package metadata constant; useful for runtime version assertions. */
export const SCHEMAS_VERSION = '0.1.0' as const;

export * from './parsers/index.js';
