import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initColorTheme } from '@/lib/theme/applyTheme'
import '@/lib/store/theme'
import './index.css'
import './styles/themes.css'
import App from './App.tsx'

initColorTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
