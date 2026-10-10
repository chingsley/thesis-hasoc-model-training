import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { USE_MOCK } from '@/lib/api/config'
import { useAuthStore } from '@/lib/store/auth'

export function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!token && !USE_MOCK) {
    return <Navigate to="/login" replace />
  }

  if (
    !USE_MOCK &&
    user?.must_change_password &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}
