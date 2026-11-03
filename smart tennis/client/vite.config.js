import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isVercel = process.env.VERCEL === '1' || mode === 'vercel' || process.env.BUILD_TARGET === 'vercel';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://127.0.0.1:3000',
          ws: true
        }
      }
    },
    build: {
      outDir: isVercel ? 'dist' : '../server/public',
      emptyOutDir: true
    }
  };
});
