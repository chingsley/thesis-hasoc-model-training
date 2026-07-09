import type {
  Post,
  ExplanationPayload,
  ModelMetrics,
  DriftDataPoint,
  VolumeDataPoint,
  PostCluster,
  BatchResult,
  AlertItem,
  Language,
} from '@/lib/types'
import {
  getMockPosts,
  generateMockExplanation,
  generateMockMetrics,
  generateMockDriftData,
  generateMockVolumeData,
  generateMockClusters,
  mockBatchClassify,
  generateMockAlerts,
} from './mock'

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export async function fetchPosts(language: Language): Promise<Post[]> {
  const all = getMockPosts()
  return delay(all.filter((p) => p.language === language))
}

export async function fetchTriagePosts(language: Language): Promise<Post[]> {
  const posts = await fetchPosts(language)
  return posts.filter((p) => p.label === 'Hate' || p.label === 'Abuse')
}

export async function fetchPostExplanations(post: Post): Promise<ExplanationPayload> {
  return delay(generateMockExplanation(post), 300)
}

export async function fetchModelMetrics(): Promise<ModelMetrics> {
  return delay(generateMockMetrics(), 150)
}

export async function fetchDriftData(): Promise<DriftDataPoint[]> {
  return delay(generateMockDriftData(), 200)
}

export async function fetchVolumeData(): Promise<VolumeDataPoint[]> {
  return delay(generateMockVolumeData(), 250)
}

export async function fetchClusters(language: Language): Promise<PostCluster[]> {
  const clusters = generateMockClusters()
  const filtered = clusters.map((c) => ({
    ...c,
    posts: c.posts.filter((p) => p.language === language),
  }))
  return delay(filtered.filter((c) => c.posts.length > 0), 200)
}

export async function fetchBorderlinePosts(language: Language): Promise<Post[]> {
  const posts = await fetchPosts(language)
  return posts.filter((p) => {
    const hateProb = p.probabilities.hate
    return hateProb >= 0.4 && hateProb <= 0.6
  })
}

export async function flagPost(postId: string): Promise<Post> {
  const all = getMockPosts()
  const post = all.find((p) => p.id === postId)
  if (post) {
    post.flagged = true
    post.triage_status = 'reported'
  }
  return delay(post!, 150)
}

export async function updateTriageStatus(
  postId: string,
  status: 'new' | 'reviewed' | 'reported'
): Promise<Post> {
  const all = getMockPosts()
  const post = all.find((p) => p.id === postId)
  if (post) {
    post.triage_status = status
  }
  return delay(post!, 150)
}

export async function batchClassify(
  texts: string[],
  language: Language
): Promise<BatchResult[]> {
  return delay(mockBatchClassify(texts, language), 500)
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  return delay(generateMockAlerts(), 100)
}

export async function markAlertRead(_alertId: string): Promise<void> {
  return delay(undefined, 100)
}

export async function mockSingleClassify(
  text: string,
  language: Language
): Promise<{ predicted_label: string; probabilities: { normal: number; abuse: number; hate: number }; explanation: ExplanationPayload }> {
  const result = mockBatchClassify([text], language)[0]
  const tempPost: Post = {
    id: 'temp_test',
    tweet: text,
    label: result.predicted_label,
    label_id: ['Normal', 'Abuse', 'Hate'].indexOf(result.predicted_label) as 0 | 1 | 2,
    language,
    split: 'test',
    length: text.length,
    predicted_label: result.predicted_label,
    predicted_label_id: ['Normal', 'Abuse', 'Hate'].indexOf(result.predicted_label) as 0 | 1 | 2,
    probabilities: result.probabilities,
    flagged: false,
    triage_status: 'new',
    timestamp: new Date().toISOString(),
  }
  const explanation = generateMockExplanation(tempPost)
  return delay({ ...result, explanation }, 400)
}
