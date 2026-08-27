import { Navigate, Outlet } from 'react-router-dom'
import { USE_MOCK } from '@/lib/api/config'
import { useAuthStore } from '@/lib/store/auth'

export function RequireAuth() {
  const token = useAuthStore((s) => s.token)

  if (!token && !USE_MOCK) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
