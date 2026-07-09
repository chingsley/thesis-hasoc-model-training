import type {
  AlertItem,
  BatchResult,
  ClassifyResult,
  DriftBaseline,
  DriftDataPoint,
  ExplanationPayload,
  IncidentReportRow,
  Label,
  Language,
  ModelMetrics,
  Post,
  PostCluster,
  ToxicTerm,
  TriageStatus,
  VolumeDataPoint,
} from '@/lib/types'

const LABELS: Label[] = ['Normal', 'Abuse', 'Hate']
const HATE_TARGETS = ['ethnic', 'religious', 'gender', 'political', 'regional']

const igboTexts: Record<Label, string[]> = {
  Normal: [
    'Ndi Igbo na-eme emume nke ukwuu taa. Anyi na-elele anya nke oma.',
    'Ego akwukwo di mma. Nwa m na-agba aka nke oma na nkuzi.',
    'Oge oma ka anyi jiri kwuo okwu nke udo na nwanne.',
  ],
  Abuse: [
    'Gbaa! Onye ahu bu onye nzuzu nke ukwuu. Ihe gbasara gi?',
    'Ihe mere gi ji na-ekwu okwu di ka onye na-enweghi uche?',
    'Onye nzuzu! Ihe mere gi ji na-eme ka anyi na-akwa akwu?',
  ],
  Hate: [
    'Ndi a bu ndi ojoo. Ha kwesiri ihapu ala anyi kpamkpam.',
    'Anyi achoghi ndi a na obodo anyi. Ha bu ndi na-ebute iwe.',
    'Ndi otu a bu ndi na-egbu mmadu. Anyi ga-ejide ha.',
  ],
}

const yorubaTexts: Record<Label, string[]> = {
  Normal: [
    'Awon Yoruba n je isimi loni. Awa n sere ati sise papo.',
    'Iwe re dara pupo. Omo mi n ko eko daradara.',
    'Awa n soro ara wa ni alafia ati ife.',
  ],
  Abuse: [
    'Ode! Eniyan yii ni were pupo. Kini o n so?',
    'Se o mo pe o n soro bi eniyan ti ko ni okan?',
    'Were! Kini o n se naa?',
  ],
  Hate: [
    'Awon eniyan yi ni buburu. Won ko ye ka won wa ni ilu wa.',
    'Awa ko fe awon yi ni agbegbe wa. Won n fa iwe wa.',
    'Awon yi n pa eniyan. Awa yoo mu won.',
  ],
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateEmbedding(seed: number, dim = 32): number[] {
  const rand = seededRandom(seed)
  const vec = Array.from({ length: dim }, () => rand() * 2 - 1)
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0)
}

function generateProbabilities(label: Label, rand: () => number) {
  const raw = [rand(), rand(), rand()]
  if (label === 'Normal') {
    raw[0] = 0.55 + rand() * 0.35
    raw[1] = rand() * 0.3
    raw[2] = rand() * 0.2
  } else if (label === 'Abuse') {
    raw[0] = rand() * 0.3
    raw[1] = 0.5 + rand() * 0.35
    raw[2] = rand() * 0.35
  } else {
    raw[0] = rand() * 0.2
    raw[1] = rand() * 0.35
    raw[2] = 0.55 + rand() * 0.35
  }
  const total = raw[0] + raw[1] + raw[2]
  return { normal: raw[0] / total, abuse: raw[1] / total, hate: raw[2] / total }
}

function pickTriageStatus(label: Label, rand: () => number): TriageStatus {
  if (label === 'Normal') return 'new'
  const r = rand()
  if (r < 0.4) return 'new'
  if (r < 0.7) return 'reviewed'
  return 'reported'
}

export function generateMockPosts(): Post[] {
  const distribution: { label: Label; count: number }[] = [
    { label: 'Normal', count: 1100 },
    { label: 'Abuse', count: 300 },
    { label: 'Hate', count: 100 },
    { label: 'Normal', count: 1100 },
    { label: 'Abuse', count: 300 },
    { label: 'Hate', count: 100 },
  ]

  const posts: Post[] = []
  let idx = 0

  for (let d = 0; d < distribution.length; d++) {
    const { label, count } = distribution[d]
    const language: Language = d < 3 ? 'igbo' : 'yoruba'
    const texts = language === 'igbo' ? igboTexts[label] : yorubaTexts[label]

    for (let i = 0; i < count; i++) {
      const rand = seededRandom(idx + 42)
      const tweet = texts[Math.floor(rand() * texts.length)]
      const probs = generateProbabilities(label, rand)
      const isCorrect = rand() < 0.87
      const predictedIdx = isCorrect
        ? LABELS.indexOf(label)
        : (LABELS.indexOf(label) + 1 + Math.floor(rand() * 2)) % 3
      const hoursAgo = Math.floor(rand() * 168)

      posts.push({
        id: `${language}_${String(++idx).padStart(5, '0')}`,
        tweet,
        label,
        label_id: LABELS.indexOf(label) as 0 | 1 | 2,
        language,
        split: rand() < 0.7 ? 'train' : rand() < 0.5 ? 'dev' : 'test',
        length: tweet.length,
        predicted_label: LABELS[predictedIdx],
        predicted_label_id: predictedIdx as 0 | 1 | 2,
        probabilities: probs,
        hate_target_category: label === 'Hate' ? HATE_TARGETS[Math.floor(rand() * HATE_TARGETS.length)] : undefined,
        flagged: label !== 'Normal' && rand() < 0.35,
        triage_status: pickTriageStatus(label, rand),
        timestamp: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
        embedding: generateEmbedding(idx, 32),
      })
    }
  }

  return posts
}

let mockPostsCache: Post[] | null = null

export function getMockPosts(): Post[] {
  if (!mockPostsCache) {
    mockPostsCache = generateMockPosts()
  }
  return mockPostsCache
}

export function generateMockExplanation(post: Post): ExplanationPayload {
  const tokens = post.tweet.split(/\s+/)
  const rand = seededRandom(post.id.length * 17)

  const limeScores: [string, number][] = tokens.map((token) => {
    const base = post.label === 'Hate' ? 0.35 : post.label === 'Abuse' ? 0.25 : 0.05
    const sign = rand() > 0.3 ? 1 : -1
    return [token, sign * base * (0.5 + rand())]
  })

  const tokenScores = (scale: number) =>
    tokens.map((token) => ({
      token,
      score: (rand() * 2 - 1) * scale,
    }))

  const faithfulness = 0.25 + rand() * 0.5
  const sparsity = 0.15 + rand() * 0.45
  const stability = 0.6 + rand() * 0.35

  return {
    id: post.id,
    label: post.label,
    text: post.tweet,
    methods: {
      lime: {
        method: 'lime',
        scores: limeScores,
        predicted_label: post.predicted_label,
        fidelity_proxy: faithfulness,
      },
      shap: {
        method: 'shap',
        tokens,
        scores: tokenScores(0.3),
        predicted_label: post.predicted_label,
      },
      attention_rollout: {
        method: 'attention_rollout',
        tokens,
        scores: tokenScores(0.25),
        predicted_label: post.predicted_label,
      },
      integrated_gradients: {
        method: 'integrated_gradients',
        tokens,
        scores: tokenScores(0.28),
        predicted_label: post.predicted_label,
      },
    },
    metrics: {
      lime_faithfulness_aopc_proxy: faithfulness,
      lime_sparsity: sparsity,
      lime_stability_jaccard: stability,
      shap_faithfulness_aopc_proxy: faithfulness * 0.9,
      shap_sparsity: sparsity * 0.85,
      attention_rollout_faithfulness_aopc_proxy: faithfulness * 0.8,
      attention_rollout_sparsity: sparsity * 0.9,
      integrated_gradients_faithfulness_aopc_proxy: faithfulness * 0.88,
      integrated_gradients_sparsity: sparsity * 0.87,
      cross_method_agreement_mean: 0.45 + rand() * 0.35,
      agreement_lime_vs_shap: 0.4 + rand() * 0.4,
      agreement_lime_vs_attention_rollout: 0.35 + rand() * 0.4,
      agreement_shap_vs_attention_rollout: 0.5 + rand() * 0.35,
    },
  }
}

export function generateMockMetrics(): ModelMetrics {
  return {
    accuracy: 0.872,
    macro_precision: 0.851,
    macro_recall: 0.843,
    macro_f1: 0.846,
    weighted_precision: 0.869,
    weighted_recall: 0.872,
    weighted_f1: 0.87,
    mcc: 0.785,
    support: 3000,
    per_class: {
      Normal: { precision: 0.921, recall: 0.945, f1: 0.933, support: 2200 },
      Abuse: { precision: 0.784, recall: 0.752, f1: 0.768, support: 600 },
      Hate: { precision: 0.847, recall: 0.833, f1: 0.84, support: 200 },
    },
    confusion_matrix: [
      [2079, 89, 32],
      [98, 451, 51],
      [41, 35, 124],
    ],
    classification_report: {},
    roc_auc_ovr: 0.931,
  }
}

export const TRAINING_BASELINE: DriftBaseline = {
  normal_avg_confidence: 0.88,
  abuse_avg_confidence: 0.76,
  hate_avg_confidence: 0.79,
  normal_ratio: 0.733,
  abuse_ratio: 0.2,
  hate_ratio: 0.067,
}

export function generateMockDriftData(): DriftDataPoint[] {
  const data: DriftDataPoint[] = []
  for (let i = 30; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    const drift = i < 7 ? 0.06 : 0
    data.push({
      date,
      normal_avg_confidence: TRAINING_BASELINE.normal_avg_confidence - drift + (Math.random() * 0.04 - 0.02),
      abuse_avg_confidence: TRAINING_BASELINE.abuse_avg_confidence - drift * 0.8 + (Math.random() * 0.04 - 0.02),
      hate_avg_confidence: TRAINING_BASELINE.hate_avg_confidence - drift * 0.9 + (Math.random() * 0.04 - 0.02),
    })
  }
  return data
}

export function generateMockVolumeData(): VolumeDataPoint[] {
  const data: VolumeDataPoint[] = []
  for (let i = 168; i >= 0; i--) {
    const date = new Date(Date.now() - i * 3600000)
    const hour = date.toISOString().slice(0, 13) + ':00'
    const normal = Math.floor(8 + Math.random() * 25)
    const abuse = Math.floor(2 + Math.random() * 8)
    const hate = i < 3 ? Math.floor(15 + Math.random() * 20) : Math.floor(Math.random() * 5)
    data.push({ hour, normal_count: normal, abuse_count: abuse, hate_count: hate, total: normal + abuse + hate })
  }
  return data
}

export function generateMockClusters(language: Language): PostCluster[] {
  const posts = getMockPosts().filter(
    (p) => p.language === language && (p.label === 'Hate' || p.label === 'Abuse') && p.embedding,
  )
  const clusters: PostCluster[] = []
  const assigned = new Set<string>()
  const threshold = 0.75

  for (const post of posts) {
    if (assigned.has(post.id) || !post.embedding) continue

    const members = posts.filter((other) => {
      if (assigned.has(other.id) || !other.embedding) return false
      return cosineSimilarity(post.embedding!, other.embedding!) >= threshold
    })

    if (members.length < 2) continue
    members.forEach((m) => assigned.add(m.id))
    clusters.push({
      cluster_id: clusters.length,
      posts: members,
      representative_text: post.tweet,
      size: members.length,
    })
  }

  return clusters.slice(0, 8)
}

export function aggregateToxicTerms(language: Language): ToxicTerm[] {
  const posts = getMockPosts().filter((p) => p.language === language && (p.label === 'Hate' || p.label === 'Abuse'))
  const termMap = new Map<string, { score: number; postIds: Set<string> }>()

  for (const post of posts) {
    const explanation = generateMockExplanation(post)
    const lime = explanation.methods.lime
    if (!lime || 'error' in lime) continue

    for (const [token, score] of lime.scores) {
      const clean = token.toLowerCase().replace(/[^\w]/g, '')
      if (clean.length < 3) continue
      const absScore = Math.abs(score)
      const existing = termMap.get(clean) ?? { score: 0, postIds: new Set() }
      existing.score += absScore
      existing.postIds.add(post.id)
      termMap.set(clean, existing)
    }

    const shap = explanation.methods.shap
    if (shap && !('error' in shap)) {
      for (const { token, score } of shap.scores) {
        const clean = token.toLowerCase().replace(/[^\w]/g, '')
        if (clean.length < 3) continue
        const existing = termMap.get(clean) ?? { score: 0, postIds: new Set() }
        existing.score += Math.abs(score) * 0.8
        existing.postIds.add(post.id)
        termMap.set(clean, existing)
      }
    }
  }

  return Array.from(termMap.entries())
    .map(([text, { score, postIds }]) => ({
      text,
      score,
      example_post_ids: Array.from(postIds).slice(0, 5),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
}

export function generateMockAlerts(): AlertItem[] {
  const types = ['hate_threshold', 'volume_spike', 'model_drift'] as const
  const severities = ['low', 'medium', 'high'] as const
  const messages: Record<string, string[]> = {
    hate_threshold: [
      'Post crossed the Hate probability threshold (0.92)',
      'High-confidence Hate post detected in live feed',
    ],
    volume_spike: [
      'Hate-labeled posts surged 400% in the last hour',
      'Abnormal post activity detected: +250% in 30 minutes',
    ],
    model_drift: [
      'Model confidence distribution shifting: -8% avg confidence this week',
      'Predicted label ratios drifted 12% from training baseline',
    ],
  }

  return Array.from({ length: 8 }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)]
    return {
      id: `alert_${i}`,
      type,
      message: messages[type][Math.floor(Math.random() * messages[type].length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
      read: Math.random() < 0.5,
    }
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function mockClassifyText(text: string, language: Language): ClassifyResult {
  const rand = seededRandom(text.length + language.length)
  const label = LABELS[Math.floor(rand() * 3)]
  const probs = generateProbabilities(label, rand)
  const post: Post = {
    id: `test_${Date.now()}`,
    tweet: text,
    label,
    label_id: LABELS.indexOf(label) as 0 | 1 | 2,
    language,
    split: 'test',
    length: text.length,
    predicted_label: label,
    predicted_label_id: LABELS.indexOf(label) as 0 | 1 | 2,
    probabilities: probs,
    flagged: false,
    triage_status: 'new',
    timestamp: new Date().toISOString(),
  }
  return { predicted_label: label, probabilities: probs, explanation: generateMockExplanation(post) }
}

export function mockBatchClassify(texts: string[], _language: Language): BatchResult[] {
  return texts.map((tweet, i) => {
    const rand = seededRandom(tweet.length + i)
    const label = LABELS[Math.floor(rand() * 3)]
    return {
      id: `batch_${i}`,
      tweet,
      predicted_label: label,
      probabilities: generateProbabilities(label, rand),
    }
  })
}

export function updatePostFlag(postId: string): Post | null {
  const posts = getMockPosts()
  const post = posts.find((p) => p.id === postId)
  if (!post) return null
  post.flagged = true
  post.triage_status = 'reported'
  return post
}

export function updatePostTriageStatus(postId: string, status: TriageStatus): Post | null {
  const posts = getMockPosts()
  const post = posts.find((p) => p.id === postId)
  if (!post) return null
  post.triage_status = status
  if (status === 'reported') post.flagged = true
  return post
}

export function buildIncidentReport(
  language: Language,
  startDate: string,
  endDate: string,
): IncidentReportRow[] {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime() + 86400000

  return getMockPosts()
    .filter((p) => {
      if (p.language !== language) return false
      if (p.triage_status !== 'reported' && !p.flagged) return false
      const ts = new Date(p.timestamp).getTime()
      return ts >= start && ts <= end
    })
    .map((p) => {
      const explanation = generateMockExplanation(p)
      const lime = explanation.methods.lime
      const highlights =
        lime && !('error' in lime)
          ? lime.scores
              .filter(([, s]) => Math.abs(s) > 0.1)
              .map(([t]) => t)
              .join(', ')
          : ''
      return {
        id: p.id,
        tweet: p.tweet,
        label: p.label,
        predicted_label: p.predicted_label,
        hate_probability: p.probabilities.hate,
        hate_target_category: p.hate_target_category ?? 'unknown',
        toxic_highlights: highlights,
        flagged: p.flagged,
        reported_date: new Date(p.timestamp).toISOString().split('T')[0],
      }
    })
}
