import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const storedTheme = window.localStorage.getItem('compreesor-theme')
  const theme = storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
} catch {
  document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

if (
  !window.compreesorDesktop?.isDesktop
  && import.meta.env.PROD
  && !['localhost', '127.0.0.1'].includes(window.location.hostname)
) {
  void import('@vercel/analytics').then(({ inject }) => inject())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
