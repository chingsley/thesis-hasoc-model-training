export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** Base URL for the FastAPI backend. Defaults to /api in dev (Vite proxy). */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : '')

export const BATCH_SIZE = 256
