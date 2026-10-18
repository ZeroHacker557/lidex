import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Dev serverda /app/* -> app.html, /admin/* -> admin.html (SPA marshrutlari) */
function spaRewrite(): Plugin {
  return {
    name: 'lidex-spa-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        const path = url.split('?')[0]!;
        if (!path.includes('.') && !path.startsWith('/@') && !path.startsWith('/api') && !path.startsWith('/socket.io')) {
          if (path === '/app' || path.startsWith('/app/')) req.url = '/app.html';
          else if (path === '/' || path === '/admin' || path.startsWith('/admin/')) req.url = '/admin.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), spaRewrite()],
  resolve: {
    alias: { '@shared': resolve(__dirname, '../shared') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'app.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
