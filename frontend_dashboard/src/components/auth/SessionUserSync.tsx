import { useEffect } from 'react'
import { fetchMe } from '@/lib/api/client'
import { USE_MOCK } from '@/lib/api/config'
import { useAuthStore } from '@/lib/store/auth'

/** Refresh persisted user flags from the API (e.g. after backend adds new UserInfo fields). */
export function SessionUserSync() {
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    if (USE_MOCK || !token) return
    let cancelled = false
    fetchMe()
      .then((user) => {
        if (!cancelled) setAuth(token, user)
      })
      .catch(() => {
        /* 401 handled in apiFetch */
      })
    return () => {
      cancelled = true
    }
  }, [token, setAuth])

  return null
}
