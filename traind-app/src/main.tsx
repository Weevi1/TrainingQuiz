import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a deploy, old chunk filenames no longer exist on the server.
// Catch stale dynamic imports and reload once to pick up the new version.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || ''
  if (msg.includes('dynamically imported module') || msg.includes('Failed to fetch')) {
    // Only auto-reload once to avoid infinite loops
    const reloaded = sessionStorage.getItem('chunk-reload')
    if (!reloaded) {
      sessionStorage.setItem('chunk-reload', '1')
      window.location.reload()
    }
  }
})
// Clear the reload flag on successful load
sessionStorage.removeItem('chunk-reload')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
