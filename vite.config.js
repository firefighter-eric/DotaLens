import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeOpenDotaApiBase } from './src/config/openDotaApiBase.js';

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  normalizeOpenDotaApiBase(
    process.env.VITE_OPENDOTA_API_BASE ?? fileEnv.VITE_OPENDOTA_API_BASE
  );

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5175,
      strictPort: true,
    },
    build: {
      manifest: true,
      reportCompressedSize: true,
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            return undefined;
          }
        },
      },
    },
  };
});
