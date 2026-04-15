import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/lookup/trs': {
        target: 'https://www.moedict.tw',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), cloudflare()],
})
