import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Desarrollo: `npm run dev` (cliente en :5173) + `npm start` (servidor en :8080); el proxy reenvía /ws.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2019', sourcemap: false, chunkSizeWarningLimit: 600 },
  server: { port: 5173, proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } } },
  preview: { port: 4173 },
});
