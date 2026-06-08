import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'process'],
      // 'crypto' intentionally excluded — the Node polyfill overwrites window.crypto
      // and removes randomUUID / subtle (Web Crypto API).
      // @ton/core only needs Buffer; crypto/stream are satisfied by the browser natively.
    }),
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/omniston-ws': {
        target: 'wss://omni-ws.ston.fi',
        ws: true,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/omniston-ws/, ''),
      },
    },
  },
})
