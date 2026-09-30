import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { Buffer } from 'node:buffer'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const clerkHost = Buffer.from(env.VITE_CLERK_PUBLISHABLE_KEY?.split('_')[2] || '', 'base64')
    .toString().replace(/\$$/, '')
  const origins = new Set()
  for (const value of [env.VITE_BACKEND_URL, /^[a-z0-9.-]+$/i.test(clerkHost) ? `https://${clerkHost}` : null]) {
    try {
      const url = new URL(value)
      if (['https:', 'http:'].includes(url.protocol)) origins.add(url.origin)
    } catch { /* An unconfigured service does not need a connection hint. */ }
  }
  return {
    plugins: [react(), tailwindcss(), {
      name: 'auth-connection-hints',
      transformIndexHtml: () => [...origins].map((href) => ({
        tag: 'link', attrs: { rel: 'preconnect', href, crossorigin: '' }, injectTo: 'head',
      })),
    }],
  }
})
