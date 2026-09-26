import { useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/Toast'
import { AppRoutes } from '@/routes/AppRoutes'
import { applyTheme, useThemeStore, watchSystemTheme } from '@/store/themeStore'

/** Keeps <html data-theme> in sync with the Appearance setting, the device theme and the current page. */
function ThemeSync() {
  const { pathname } = useLocation()
  const preference = useThemeStore((state) => state.preference)

  useEffect(() => {
    applyTheme(preference, pathname)
    if (preference !== 'system') return
    return watchSystemTheme(() => applyTheme(preference, pathname))
  }, [preference, pathname])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
