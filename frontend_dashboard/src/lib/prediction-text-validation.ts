/** Keep in sync with backend_api_server/app/text_validation.py */

export const MIN_PREDICTION_TEXT_LEN = 10
export const MIN_SINGLE_WORD_LEN = 20

const LABEL_NAMES = new Set(['normal', 'abuse', 'hate'])
const PRED_REF_RE = /^pred_\d+$/i
const PURE_NUMERIC_RE = /^\d+$/
const PROB_LIKE_RE = /^\d{1,3}(\.\d+)?%?$/
const WORD_RE = /\p{L}+/gu

export function validatePredictionText(text: string): string {
  const t = text.trim()
  if (!t) throw new Error('Text is empty.')
  if (t.length < MIN_PREDICTION_TEXT_LEN) {
    throw new Error(
      `Text must be at least ${MIN_PREDICTION_TEXT_LEN} characters. Short inputs are not reliable for this model.`,
    )
  }
  if (PURE_NUMERIC_RE.test(t)) {
    throw new Error('Text cannot be only digits — check that your CSV uses the message column.')
  }
  if (PROB_LIKE_RE.test(t)) {
    throw new Error('Text looks like a probability or percentage, not a message.')
  }
  if (LABEL_NAMES.has(t.toLowerCase())) {
    throw new Error('Text cannot be a class label (Normal, Abuse, or Hate).')
  }
  if (PRED_REF_RE.test(t)) {
    throw new Error('Text looks like a post id (pred_N), not message content.')
  }
  const words = t.match(WORD_RE) ?? []
  if (words.length < 2 && t.length < MIN_SINGLE_WORD_LEN) {
    throw new Error('Text must contain at least two words or be a longer message.')
  }
  return t
}
