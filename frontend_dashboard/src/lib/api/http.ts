import { API_BASE_URL } from './config'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, body || response.statusText)
  }

  return response.json() as Promise<T>
}

export interface HealthResponse {
  status: string
  device: string
  models: Record<string, string>
  routing: string
}

export interface PredictResponse {
  predicted_label: string
  probabilities: { normal: number; abuse: number; hate: number }
  model_id: string
  language: string
  used_fallback: boolean
}

export interface BatchPredictResponse {
  results: Array<{
    text: string
    predicted_label: string
    probabilities: { normal: number; abuse: number; hate: number }
  }>
  model_id: string
}

export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health')
}
