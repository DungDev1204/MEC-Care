import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { proxy: Object.fromEntries(['/api', '/auth', '/health', '/app'].map(path => [path, { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5180', changeOrigin: true }])) },
  build: { sourcemap: false },
});
