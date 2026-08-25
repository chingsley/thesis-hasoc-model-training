import { USE_MOCK } from './config'

export type DataSource = 'mock' | 'live'

export type EndpointKey =
  | 'posts'
  | 'triage'
  | 'explanations'
  | 'metrics'
  | 'drift'
  | 'volume'
  | 'clusters'
  | 'borderline'
  | 'flagPost'
  | 'updateTriageStatus'
  | 'batchClassify'
  | 'singleClassify'
  | 'alerts'
  | 'wordCloud'
  | 'exportReport'
  | 'stats'

/** Whether an endpoint serves mock or live data (hybrid endpoints follow USE_MOCK). */
export function getDataSource(key: EndpointKey): DataSource {
  switch (key) {
    case 'metrics':
    case 'batchClassify':
    case 'singleClassify':
      return USE_MOCK ? 'mock' : 'live'
    default:
      return 'mock'
  }
}

export const MOCK_PREFIX = 'mock'

export function prefixMockId(id: string): string {
  if (id.startsWith(`${MOCK_PREFIX}_`)) return id
  return `${MOCK_PREFIX}_${id}`
}

export function prefixMockMessage(message: string): string {
  if (message.startsWith(`${MOCK_PREFIX} `)) return message
  return `${MOCK_PREFIX} ${message}`
}

export function isMockId(id: string): boolean {
  return id.startsWith(`${MOCK_PREFIX}_`) || id.startsWith(`${MOCK_PREFIX}-`)
}
