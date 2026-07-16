import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { registerSW } from './registerSW'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

const root = createRoot(container)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerSW()

const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('hidden')
  setTimeout(() => splash.remove(), 500)
}
