import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { publicPrivacyPlugin } from './scripts/buildPrivacy.mjs';

export default defineConfig({
  plugins: [react(), publicPrivacyPlugin()],
  build: { copyPublicDir: false },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
});
