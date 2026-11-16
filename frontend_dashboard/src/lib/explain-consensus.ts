import type { ExplanationPayload, XaiMethod } from './types'

/**
 * Merges the four explanation methods into one word-level answer for the plain-language view.
 *
 * Each method scores different units: LIME scores whole words, SHAP scores text pieces, and
 * Attention Rollout and Integrated Gradients score SentencePiece sub-word tokens. Every method's
 * scores are first summed into whole words of the post. Each method then "picks" its strongest
 * words that push towards the predicted label, and a word's strength is the number of methods
 * that picked it.
 */

export const CONSENSUS_METHODS: XaiMethod[] = [
  'lime',
  'shap',
  'attention_rollout',
  'integrated_gradients',
]

/** How many of its strongest words each method picks. */
export const PICKS_PER_METHOD = 5
/** A key word needs at least this many methods behind it. */
export const MIN_METHODS_FOR_KEY_WORD = 2
/** Most key words listed in the plain view. */
export const MAX_KEY_WORDS = 5

const SPECIAL_TOKENS = new Set(['<s>', '</s>', '<pad>', '<unk>', '<mask>', '[cls]', '[sep]', '[pad]'])
const WORD_START = /^[▁Ġ\s]/
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

/** Comparison key for a word: Unicode-normalised, lower-case, no surrounding punctuation. */
export function wordKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[▁Ġ]/g, '')
    .trim()
    .toLowerCase()
    .replace(EDGE_PUNCTUATION, '')
}

type MethodEntry = NonNullable<ExplanationPayload['methods'][XaiMethod]>

/** The post's words, split on whitespace, as the tokenizer also sees them. */
export function postWords(text: string): string[] {
  return text.trim().split(/\s+/).filter((word) => word !== '')
}

/**
 * Sums one method's scores into words of the post, keyed by wordKey.
 * Returns null when the method has no usable result.
 */
export function methodWordScores(
  entry: MethodEntry | undefined,
  words: string[],
): Map<string, number> | null {
  if (!entry || 'error' in entry) return null
  const raw = (entry as { scores?: unknown[] }).scores ?? []
  if (raw.length === 0) return null

  const totals = new Map<string, number>()
  const add = (text: string, score: number) => {
    if (!Number.isFinite(score)) return
    // A scored unit can still hold several words (guards odd tokenisations).
    for (const part of text.split(/\s+/)) {
      const key = wordKey(part)
      if (!key) continue
      totals.set(key, (totals.get(key) ?? 0) + score)
    }
  }

  if (Array.isArray(raw[0])) {
    // LIME: unordered [word, weight] pairs.
    for (const [token, score] of raw as [string, number][]) add(String(token), Number(score))
    return totals.size > 0 ? totals : null
  }

  // Token methods: join consecutive pieces until a word boundary.
  const groups: { text: string; score: number }[] = []
  let current: { text: string; score: number } | null = null
  const flush = () => {
    if (current) groups.push(current)
    current = null
  }
  for (const item of raw as { token?: string; score?: number }[]) {
    const token = String(item?.token ?? '')
    const score = Number(item?.score ?? 0)
    if (token.trim() === '' || SPECIAL_TOKENS.has(token.trim().toLowerCase())) {
      flush()
      continue
    }
    if (WORD_START.test(token)) flush()
    current ??= { text: '', score: 0 }
    current.text += token.replace(/[▁Ġ]/g, '').trim()
    current.score += score
    if (/\s$/.test(token)) flush()
  }
  flush()

  if (groups.length === words.length) {
    // One group per word of the post: match by position. Matching by spelling is not safe,
    // because SHAP's text pieces can repeat a word's first letter (e.g. "ọọjọọ" for "ọjọọ").
    groups.forEach((group, index) => add(words[index], group.score))
  } else {
    for (const group of groups) add(group.text, group.score)
  }
  return totals.size > 0 ? totals : null
}

export interface KeyWord {
  /** Comparison key (see wordKey). */
  key: string
  /** The word as written in the post. */
  display: string
  /** Number of methods that picked this word. */
  votes: number
}

export interface ConsensusResult {
  /** Methods that returned a usable explanation. */
  methodsUsed: number
  /** Words picked by at least MIN_METHODS_FOR_KEY_WORD methods, strongest first. */
  keyWords: KeyWord[]
  /** True when no word reached that bar; keyWords then holds the single-method picks. */
  weak: boolean
  /** Votes per word key, for highlighting the post. */
  votesByKey: Map<string, number>
}

export function consensusKeyWords(
  text: string,
  methods: ExplanationPayload['methods'],
): ConsensusResult {
  // Words of the post, in order, so key words are shown as written and can be highlighted.
  const displayByKey = new Map<string, string>()
  const orderByKey = new Map<string, number>()
  const words = postWords(text)
  words.forEach((word, index) => {
    const key = wordKey(word)
    if (!key || displayByKey.has(key)) return
    displayByKey.set(key, word.normalize('NFC').replace(EDGE_PUNCTUATION, ''))
    orderByKey.set(key, index)
  })

  const votes = new Map<string, number>()
  const strength = new Map<string, number>()
  let methodsUsed = 0

  for (const method of CONSENSUS_METHODS) {
    const scores = methodWordScores(methods[method], words)
    if (!scores) continue
    methodsUsed += 1
    // Only words that are in the post and push towards the predicted label.
    const ranked = [...scores.entries()]
      .filter(([key, score]) => score > 0 && displayByKey.has(key))
      .sort((a, b) => b[1] - a[1])
    if (ranked.length === 0) continue
    const top = ranked[0][1]
    for (const [key, score] of ranked.slice(0, PICKS_PER_METHOD)) {
      votes.set(key, (votes.get(key) ?? 0) + 1)
      strength.set(key, (strength.get(key) ?? 0) + score / top)
    }
  }

  const ranked: KeyWord[] = [...votes.entries()]
    .map(([key, count]) => ({ key, display: displayByKey.get(key) ?? key, votes: count }))
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        (strength.get(b.key) ?? 0) - (strength.get(a.key) ?? 0) ||
        (orderByKey.get(a.key) ?? 0) - (orderByKey.get(b.key) ?? 0),
    )

  const agreed = ranked.filter((word) => word.votes >= MIN_METHODS_FOR_KEY_WORD)
  const weak = agreed.length === 0
  const keyWords = (weak ? ranked.slice(0, 3) : agreed).slice(0, MAX_KEY_WORDS)
  const votesByKey = new Map(keyWords.map((word) => [word.key, word.votes]))

  return { methodsUsed, keyWords, weak, votesByKey }
}

/** The post split into words and the gaps between them, each word with its vote count. */
export function highlightSegments(
  text: string,
  votesByKey: Map<string, number>,
): { text: string; votes: number }[] {
  return text
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, votes: votesByKey.get(wordKey(part)) ?? 0 }))
}
