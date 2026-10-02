import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { applyTheme, storedTheme } from './context/ThemeContext'

// Paint the last used theme right away (no dark/light flash on reload)
applyTheme(storedTheme() || 'dark')


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
