import type { Language, Post, TriageStatus } from '@/lib/types'
import {
  aggregateToxicTerms,
  buildIncidentReport,
  generateMockAlerts,
  generateMockClusters,
  generateMockDriftData,
  generateMockExplanation,
  generateMockMetrics,
  generateMockVolumeData,
  getMockPosts,
  mockBatchClassify,
  mockClassifyText,
  updatePostFlag,
  updatePostTriageStatus,
} from '@/lib/api/mock'

const delay = <T>(data: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms))

export async function fetchPosts(language: Language) {
  const posts = getMockPosts().filter((p) => p.language === language)
  return delay(posts)
}

export async function fetchTriagePosts(language: Language, label?: string) {
  let posts = getMockPosts().filter(
    (p) => p.language === language && (p.predicted_label === 'Abuse' || p.predicted_label === 'Hate'),
  )
  if (label && label !== 'all') {
    posts = posts.filter((p) => p.predicted_label === label)
  }
  return delay(posts)
}

export async function fetchBorderlinePosts(language: Language) {
  const posts = getMockPosts().filter(
    (p) => p.language === language && p.probabilities.hate >= 0.4 && p.probabilities.hate <= 0.6,
  )
  return delay(posts)
}

export async function fetchPostExplanation(post: Post) {
  return delay(generateMockExplanation(post))
}

export async function fetchModelMetrics() {
  return delay(generateMockMetrics())
}

export async function fetchDriftData() {
  return delay(generateMockDriftData())
}

export async function fetchVolumeData() {
  return delay(generateMockVolumeData())
}

export async function fetchClusters(language: Language) {
  return delay(generateMockClusters(language))
}

export async function fetchAlerts() {
  return delay(generateMockAlerts())
}

export async function fetchToxicTerms(language: Language) {
  return delay(aggregateToxicTerms(language))
}

export async function classifyText(text: string, language: Language) {
  return delay(mockClassifyText(text, language), 600)
}

export async function batchClassify(texts: string[], language: Language) {
  return delay(mockBatchClassify(texts, language), 800)
}

export async function flagPost(postId: string) {
  const post = updatePostFlag(postId)
  if (!post) throw new Error('Post not found')
  return delay(post)
}

export async function updateTriageStatus(postId: string, status: TriageStatus) {
  const post = updatePostTriageStatus(postId, status)
  if (!post) throw new Error('Post not found')
  return delay(post)
}

export async function exportIncidentReport(language: Language, startDate: string, endDate: string) {
  return delay(buildIncidentReport(language, startDate, endDate))
}
