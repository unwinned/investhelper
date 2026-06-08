// crypto.randomUUID is restricted to secure contexts (HTTPS/localhost).
// Polyfill using getRandomValues which works on plain HTTP too.
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { OmnistonProvider } from '@ston-fi/omniston-sdk-react'
import App from './src/App.jsx'
import { omniston } from './src/lib/omniston.js'
import './src/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
      <OmnistonProvider omniston={omniston}>
        <App />
      </OmnistonProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
)
