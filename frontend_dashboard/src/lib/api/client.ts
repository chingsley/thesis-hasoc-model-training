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
  Label,
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
import { BATCH_SIZE, USE_MOCK } from './config'
import { apiFetch, type BatchPredictResponse, type PredictResponse } from './http'

export { getDataSource, type DataSource, type EndpointKey } from './sources'

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

export async function fetchModelMetrics(language: Language): Promise<ModelMetrics> {
  if (USE_MOCK) {
    return delay(generateMockMetrics(), 150)
  }
  return apiFetch<ModelMetrics>(`/metrics?language=${language}`)
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
  if (USE_MOCK) {
    return delay(mockBatchClassify(texts, language), 500)
  }

  const results: BatchResult[] = []
  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const chunk = texts.slice(offset, offset + BATCH_SIZE)
    const data = await apiFetch<BatchPredictResponse>('/predict/batch', {
      method: 'POST',
      body: JSON.stringify({ texts: chunk, language }),
    })

    data.results.forEach((item, index) => {
      results.push({
        id: `batch_${offset + index}`,
        tweet: item.text,
        predicted_label: item.predicted_label as Label,
        probabilities: item.probabilities,
      })
    })
  }

  return results
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  return delay(generateMockAlerts(), 100)
}

export async function markAlertRead(_alertId: string): Promise<void> {
  return delay(undefined, 100)
}

export interface SingleClassifyResult {
  predicted_label: string
  probabilities: { normal: number; abuse: number; hate: number }
  explanation?: ExplanationPayload
  model_id?: string
  used_fallback?: boolean
}

export async function singleClassify(
  text: string,
  language: Language
): Promise<SingleClassifyResult> {
  if (USE_MOCK) {
    const result = mockBatchClassify([text], language)[0]
    const tempPost: Post = {
      id: 'mock_temp_test',
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
    return delay({ ...result, explanation: generateMockExplanation(tempPost) }, 400)
  }

  const data = await apiFetch<PredictResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  })

  return {
    predicted_label: data.predicted_label,
    probabilities: data.probabilities,
    model_id: data.model_id,
    used_fallback: data.used_fallback,
  }
}

/** @deprecated Use singleClassify instead */
export const mockSingleClassify = singleClassify
