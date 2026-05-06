/**
 * Parser-types schema tests.
 *
 * Tests use Node's built-in test runner (no Vitest/Jest dep). The
 * package's tsc build emits JS; npm test compiles then runs node --test
 * against the emitted .js files.
 *
 * Coverage:
 *  - Good-sample: realistic Sprint 1 ParsedDocument shape parses cleanly
 *  - Bad-sample 1: missing required body_md field rejects
 *  - Bad-sample 2: wrong type (level as string instead of number) rejects
 *  - Bad-sample 3: phantom field (top-level body_markdown) — Zod by
 *    default is permissive on unknown keys (.passthrough()), so the
 *    phantom-field test asserts the parsed result has NO body_markdown
 *    key (i.e. Zod strips it via .strip() default). This proves the
 *    consumer-side phantom branch (server.ts:84-86 reading
 *    parsed.body_markdown) is unreachable: the field is dropped at the
 *    schema layer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ParsedDocumentSchema,
  ParsedSectionSchema,
  ParserFormatSchema,
} from '../index.js';

test('ParserFormatSchema accepts docx and pdf', () => {
  assert.equal(ParserFormatSchema.parse('docx'), 'docx');
  assert.equal(ParserFormatSchema.parse('pdf'), 'pdf');
});

test('ParserFormatSchema rejects unknown format', () => {
  const result = ParserFormatSchema.safeParse('rtf');
  assert.equal(result.success, false);
});

test('ParsedSectionSchema parses good sample', () => {
  const good = {
    heading: 'Section 1: Inspection Requirements',
    level: 1,
    body_md: 'The PSV shall be inspected every 12 months per API 510.',
  };
  const parsed = ParsedSectionSchema.parse(good);
  assert.equal(parsed.heading, good.heading);
  assert.equal(parsed.level, 1);
  assert.equal(parsed.body_md, good.body_md);
});

test('ParsedSectionSchema rejects sample missing body_md', () => {
  const bad = { heading: 'Section 1', level: 1 };
  const result = ParsedSectionSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test('ParsedSectionSchema rejects level as string', () => {
  const bad = { heading: 'Section 1', level: '1', body_md: 'body' };
  const result = ParsedSectionSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test('ParsedDocumentSchema parses realistic Sprint 1 sample', () => {
  const good = {
    title: 'Wyella MVP1 PSV PRD Artifact Pack',
    version: '1.0',
    format: 'docx' as const,
    format_version: '1.0',
    parsed_at: '2026-05-06T17:00:00.000Z',
    sections: [
      { heading: 'Introduction', level: 1, body_md: 'Background and scope.' },
      { heading: 'Inspection', level: 2, body_md: 'Annual inspection per API 510.' },
    ],
    tables: [
      { section: '2.1', rows: [['Column A', 'Column B'], ['Value 1', 'Value 2']] },
    ],
    body_char_count: 1234,
  };
  const parsed = ParsedDocumentSchema.parse(good);
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.tables.length, 1);
  assert.equal(parsed.body_char_count, 1234);
});

test('ParsedDocumentSchema rejects sample missing sections array', () => {
  const bad = {
    title: 'X', version: '1', format: 'docx', format_version: '1',
    parsed_at: '2026-05-06T00:00:00Z', tables: [], body_char_count: 0,
  };
  const result = ParsedDocumentSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test('phantom body_markdown key is stripped by ParsedDocumentSchema', () => {
  // The consumer-side dead branch in amos-extraction read parsed.body_markdown
  // off the cached metadata.parsed JSON. The canonical schema has no
  // body_markdown field. Zod's default behaviour on z.object is .strip() —
  // unknown keys are removed. This test confirms the field is dropped, which
  // is what makes the consumer-side phantom branch architecturally
  // unreachable post-extraction.
  const inputWithPhantom = {
    title: 'X', version: '1', format: 'docx' as const, format_version: '1',
    parsed_at: '2026-05-06T00:00:00Z',
    sections: [{ heading: 'A', level: 1, body_md: 'body' }],
    tables: [],
    body_char_count: 4,
    body_markdown: 'PHANTOM — should be stripped',
  };
  const parsed = ParsedDocumentSchema.parse(inputWithPhantom);
  assert.equal('body_markdown' in parsed, false);
});
