/**
 * Canonical parser-output types for AMOS procedure ingestion.
 *
 * Producer: wyella/amos-engine src/lib/parsers/{docx.ts,pdf.ts}
 * Consumers: amos-engine (procedure-ingest pipeline), amos-extraction
 * (extraction worker reading procedure.metadata.parsed JSON).
 *
 * Extracted from amos-engine/src/lib/parsers/types.ts at 0.1.0
 * (2026-05-06) per OPE-150 sub-finding (w) and PB-AMOS-S02-D5-1-IMPL.
 * Origin closed the field-name drift class of failure that produced
 * Sprint 1 Failure Mode 6 (s.text vs s.body_md drift on the consumer
 * side silently dropped 97% of body content from production
 * extraction).
 *
 * 1:1 mirror of the producer's existing TypeScript shape per Programme
 * Brain Q2 disposition. No Zod refinements (z.string() rather than
 * z.string().min(1) etc) — refinements are a separate decision
 * deferred until parser invariants firm up.
 */
import { z } from 'zod';

export const ParserFormatSchema = z.enum(['docx', 'pdf']);
export type ParserFormat = z.infer<typeof ParserFormatSchema>;

export const ParsedSectionSchema = z.object({
  heading: z.string(),
  /** 1 (top) .. 6 (deepest) */
  level: z.number(),
  /** Markdown body for this section. */
  body_md: z.string(),
});
export type ParsedSection = z.infer<typeof ParsedSectionSchema>;

export const ParsedTableSchema = z.object({
  /** Best-guess section identifier (heading number, or '' if not detected). */
  section: z.string(),
  /** rows[0] is headers; rows[1..] are data rows. */
  rows: z.array(z.array(z.string())),
});
export type ParsedTable = z.infer<typeof ParsedTableSchema>;

export const ParsedDocumentSchema = z.object({
  title: z.string(),
  version: z.string(),
  format: ParserFormatSchema,
  format_version: z.string(),
  /** ISO timestamp. */
  parsed_at: z.string(),
  sections: z.array(ParsedSectionSchema),
  tables: z.array(ParsedTableSchema),
  /** Total characters across all section bodies — for AI extraction budget. */
  body_char_count: z.number(),
});
export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;
