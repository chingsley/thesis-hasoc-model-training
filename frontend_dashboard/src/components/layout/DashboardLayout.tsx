import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAlerts } from '@/hooks/use-alerts'
import { AlertToast } from '@/components/alerts/AlertToast'
import { Toaster } from '@/components/ui/sonner'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useAlerts()

  return (
    <div className="flex h-screen overflow-hidden bg-[#eaebf4]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AlertToast />
      <Toaster />
    </div>
  )
}
