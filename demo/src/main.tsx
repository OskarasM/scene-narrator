import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.js'
import './fonts.css'
import './tokens.css'
import './chrome.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
