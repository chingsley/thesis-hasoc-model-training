import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const Overview = lazy(() => import('@/pages/Overview'))
const Triage = lazy(() => import('@/pages/Triage'))
const Explainability = lazy(() => import('@/pages/Explainability'))
const Analysis = lazy(() => import('@/pages/Analysis'))
const Testing = lazy(() => import('@/pages/Testing'))
const Performance = lazy(() => import('@/pages/Performance'))
const Reports = lazy(() => import('@/pages/Reports'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<Suspense fallback={<PageLoader />}><Overview /></Suspense>} />
              <Route path="triage" element={<Suspense fallback={<PageLoader />}><Triage /></Suspense>} />
              <Route path="explainability" element={<Suspense fallback={<PageLoader />}><Explainability /></Suspense>} />
              <Route path="analysis" element={<Suspense fallback={<PageLoader />}><Analysis /></Suspense>} />
              <Route path="testing" element={<Suspense fallback={<PageLoader />}><Testing /></Suspense>} />
              <Route path="performance" element={<Suspense fallback={<PageLoader />}><Performance /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
