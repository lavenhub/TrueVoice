import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // frontend/ is the root — index.html lives here
  root: __dirname,
  publicDir: path.join(__dirname, 'public'),
  build: {
    // Output dist/ at the project root so backend/server.js can serve it
    outDir: path.join(__dirname, '..', 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    // Proxy API calls to backend during dev so no CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
