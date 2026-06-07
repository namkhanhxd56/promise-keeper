import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { createHttpApi } from './lib/apiClient'

// Desktop (Electron) provides window.api via preload.js over IPC.
// On the web build there is no preload, so back it with the HTTP API.
if (!window.api) {
  window.api = createHttpApi()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
