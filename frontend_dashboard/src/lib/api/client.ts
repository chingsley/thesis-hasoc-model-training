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
  User,
  LoginResponse,
  OverviewStats,
  XaiMethod,
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

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export async function fetchPosts(language: Language, limit?: number): Promise<Post[]> {
  if (USE_MOCK) {
    const all = getMockPosts()
    return delay(all.filter((p) => p.language === language))
  }
  // The logged-in user's own processed texts (prediction log), not the test set.
  const params = limit ? `&limit=${limit}` : ''
  return apiFetch<Post[]>(`/predictions?language=${language}${params}`)
}

export async function fetchTriagePosts(language: Language): Promise<Post[]> {
  if (USE_MOCK) {
    const posts = await fetchPosts(language)
    return posts.filter((p) => p.predicted_label === 'Hate' || p.predicted_label === 'Abuse')
  }
  // Server-side label filter: toxic posts outside the newest-500 window still show up.
  return apiFetch<Post[]>(`/predictions?language=${language}&label=Hate,Abuse`)
}

export async function fetchExplanationMethod(
  post: Post,
  method: XaiMethod
): Promise<ExplanationPayload> {
  if (USE_MOCK) {
    const full = generateMockExplanation(post)
    return delay(
      { ...full, methods: { [method]: full.methods[method] } } as ExplanationPayload,
      300
    )
  }
  // One method per request: the page fires all four in parallel and renders
  // each panel as it lands; the backend caches each (language, methods, text).
  return apiFetch<ExplanationPayload>('/explain', {
    method: 'POST',
    body: JSON.stringify({ text: post.tweet, language: post.language, methods: [method], post_id: post.id }),
  })
}

export async function fetchModelMetrics(language: Language): Promise<ModelMetrics> {
  if (USE_MOCK) {
    return delay(generateMockMetrics(), 150)
  }
  return apiFetch<ModelMetrics>(`/metrics?language=${language}`)
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ status: string }>('/auth/logout', { method: 'POST' })
  } catch {
    // Best-effort: the local session is cleared regardless of the server response.
  }
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>('/auth/me')
}

export async function fetchOverviewStats(language: Language): Promise<OverviewStats> {
  if (USE_MOCK) {
    return delay({ language, total: 42, normal: 20, abuse: 10, hate: 12 })
  }
  return apiFetch<OverviewStats>(`/stats/overview?language=${language}`)
}

export async function fetchDriftData(language: Language): Promise<DriftDataPoint[]> {
  if (USE_MOCK) {
    return delay(generateMockDriftData(), 200)
  }
  return apiFetch<DriftDataPoint[]>(`/analytics/drift?language=${language}`)
}

export async function fetchVolumeData(language: Language): Promise<VolumeDataPoint[]> {
  if (USE_MOCK) {
    return delay(generateMockVolumeData(), 250)
  }
  return apiFetch<VolumeDataPoint[]>(`/analytics/volume?language=${language}`)
}

export async function fetchClusters(language: Language): Promise<PostCluster[]> {
  if (USE_MOCK) {
    const clusters = generateMockClusters()
    const filtered = clusters.map((c) => ({
      ...c,
      posts: c.posts.filter((p) => p.language === language),
    }))
    return delay(filtered.filter((c) => c.posts.length > 0), 200)
  }
  return apiFetch<PostCluster[]>(`/predictions/clusters?language=${language}`)
}

export async function fetchBorderlinePosts(language: Language): Promise<Post[]> {
  if (USE_MOCK) {
    const posts = await fetchPosts(language)
    return posts.filter((p) => {
      const hateProb = p.probabilities.hate
      return hateProb >= 0.4 && hateProb <= 0.6
    })
  }
  // Server-side probability filter: matches beyond the newest-500 window still show up.
  return apiFetch<Post[]>(`/predictions?language=${language}&hate_min=0.4&hate_max=0.6`)
}

export async function flagPost(postId: string): Promise<Post> {
  if (USE_MOCK) {
    const all = getMockPosts()
    const post = all.find((p) => p.id === postId)
    if (post) {
      post.flagged = true
      post.triage_status = 'reported'
    }
    return delay(post!, 150)
  }
  return apiFetch<Post>(`/predictions/${postId}/flag`, { method: 'POST' })
}

export async function updateTriageStatus(
  postId: string,
  status: 'new' | 'reviewed' | 'reported'
): Promise<Post> {
  if (USE_MOCK) {
    const all = getMockPosts()
    const post = all.find((p) => p.id === postId)
    if (post) {
      post.triage_status = status
      post.flagged = status === 'reported'
    }
    return delay(post!, 150)
  }
  return apiFetch<Post>(`/predictions/${postId}/triage`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
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
  if (USE_MOCK) {
    return delay(generateMockAlerts(), 100)
  }
  return apiFetch<AlertItem[]>('/alerts')
}

export async function markAlertRead(alertId: string): Promise<void> {
  if (USE_MOCK) {
    return delay(undefined, 100)
  }
  await apiFetch<{ status: string }>(`/alerts/${alertId}/read`, { method: 'POST' })
}

export interface WordCloudTerm {
  text: string
  value: number
  /** occurrences and per-occurrence toxicity drop — present only from /predictions/toxic-terms */
  count?: number
  contribution?: number
}

export async function fetchWordCloud(language: Language): Promise<WordCloudTerm[]> {
  return apiFetch<WordCloudTerm[]>(`/predictions/wordcloud?language=${language}`)
}

export async function fetchToxicTerms(language: Language): Promise<WordCloudTerm[]> {
  return apiFetch<WordCloudTerm[]>(`/predictions/toxic-terms?language=${language}`)
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

  // Fetch a SHAP token attribution so the result view can highlight toxic tokens.
  // Kept to one method for speed; a missing shap dependency surfaces as a
  // per-method error the UI already handles.
  let explanation: ExplanationPayload | undefined
  try {
    explanation = await apiFetch<ExplanationPayload>('/explain', {
      method: 'POST',
      body: JSON.stringify({ text, language, methods: ['shap'] }),
    })
  } catch {
    explanation = undefined
  }

  return {
    predicted_label: data.predicted_label,
    probabilities: data.probabilities,
    explanation,
    model_id: data.model_id,
    used_fallback: data.used_fallback,
  }
}

/** @deprecated Use singleClassify instead */
export const mockSingleClassify = singleClassify
