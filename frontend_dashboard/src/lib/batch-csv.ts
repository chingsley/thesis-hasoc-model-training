import { validatePredictionText } from '@/lib/prediction-text-validation'

const TEXT_HEADERS = new Set([
  'text',
  'tweet',
  'message',
  'post',
  'content',
  'body',
  'comment',
])

const EXPORT_HEADERS = new Set([
  'id',
  'tweet',
  'text',
  'label',
  'predicted_label',
  'model_prediction',
  'reviewer_label',
  'initial_model_prediction',
  'hate_probability',
  'hate_prob',
  'prob_hate',
  'normal_prob',
  'abuse_prob',
  'triage_status',
  'flagged',
  'reported_date',
  'normal',
  'abuse',
  'hate',
])

export type BatchCsvSuccess = {
  ok: true
  texts: string[]
  skippedBlank: number
}

export type BatchCsvFailure = {
  ok: false
  errors: string[]
}

export type BatchCsvResult = BatchCsvSuccess | BatchCsvFailure

/** Parse one CSV record (handles quoted commas). */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(cur)
  return cells.map((cell) => cell.trim())
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, '_')
}

function isExportHeaderRow(cells: string[]): boolean {
  const norms = cells.map(normalizeHeader)
  return (
    norms.includes('predicted_label') ||
    norms.includes('hate_probability') ||
    norms.includes('model_prediction') ||
    norms.includes('reviewer_label') ||
    norms.includes('initial_model_prediction')
  )
}

function pickTextColumnIndex(headers: string[]): number | null {
  const norms = headers.map(normalizeHeader)
  for (let i = 0; i < norms.length; i++) {
    if (TEXT_HEADERS.has(norms[i])) return i
  }
  return null
}

function rowLooksLikeHeader(cells: string[]): boolean {
  if (cells.length === 1) {
    const h = normalizeHeader(cells[0])
    return TEXT_HEADERS.has(h)
  }
  const norms = cells.map(normalizeHeader)
  if (norms.every((h) => EXPORT_HEADERS.has(h) || TEXT_HEADERS.has(h))) {
    return norms.some((h) => TEXT_HEADERS.has(h))
  }
  return norms.some((h) => TEXT_HEADERS.has(h)) && !norms.some((h) => h.startsWith('pred_'))
}

/**
 * Accepts:
 * - One message per line (.txt or single-column CSV)
 * - CSV with a header row and a `text` / `tweet` / `message` / … column
 *
 * Rejects dashboard export files used as upload input, numeric-only cells, and invalid rows.
 */
export function parseBatchUploadFile(raw: string): BatchCsvResult {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return { ok: false, errors: ['File is empty.'] }
  }

  const rows = lines.map(parseCsvLine)
  const errors: string[] = []
  let texts: string[] = []
  let skippedBlank = 0

  const first = rows[0]
  const multiColumn = first.length > 1

  if (multiColumn) {
    if (!rowLooksLikeHeader(first)) {
      return {
        ok: false,
        errors: [
          'Multi-column CSV must start with a header row.',
          'Include a column named text, tweet, message, post, or content.',
          'Do not upload Review & Report or batch result exports — use a file of messages only.',
        ],
      }
    }
    if (isExportHeaderRow(first)) {
      return {
        ok: false,
        errors: [
          'This file looks like a dashboard export (predicted_label, hate_probability, etc.).',
          'Batch upload expects only messages, with a header such as: text',
          'Or one message per line with no header.',
        ],
      }
    }
    const textIdx = pickTextColumnIndex(first)
    if (textIdx === null) {
      return {
        ok: false,
        errors: [
          `No message column found. Expected one of: ${[...TEXT_HEADERS].join(', ')}.`,
          `Found columns: ${first.join(', ')}`,
        ],
      }
    }
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r]
      if (cells.every((c) => !c.trim())) {
        skippedBlank++
        continue
      }
      if (cells.length <= textIdx) {
        errors.push(`Row ${r + 1}: missing message column.`)
        continue
      }
      const value = cells[textIdx].trim()
      try {
        texts.push(validatePredictionText(value))
      } catch (e) {
        errors.push(`Row ${r + 1}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } else {
    let start = 0
    if (rows.length > 1 && TEXT_HEADERS.has(normalizeHeader(first[0]))) {
      start = 1
    }
    for (let r = start; r < rows.length; r++) {
      const value = rows[r][0]?.trim() ?? ''
      if (!value) {
        skippedBlank++
        continue
      }
      try {
        texts.push(validatePredictionText(value))
      } catch (e) {
        errors.push(`Row ${r + 1}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, 8)
    if (errors.length > 8) {
      shown.push(`…and ${errors.length - 8} more invalid row(s).`)
    }
    return { ok: false, errors: shown }
  }
  if (texts.length === 0) {
    return { ok: false, errors: ['No valid messages found after validation.'] }
  }
  return { ok: true, texts, skippedBlank }
}
