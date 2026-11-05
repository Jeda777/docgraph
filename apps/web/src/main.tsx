import 'zod/compile'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { useUiStore } from './lib/stores'

if (document.documentElement.classList.contains('dark')) {
  useUiStore.setState({ theme: 'dark' })
}

// biome-ignore lint/style/noNonNullAssertion: #root is a static element in index.html
createRoot(document.getElementById('root')!).render(<App />)
