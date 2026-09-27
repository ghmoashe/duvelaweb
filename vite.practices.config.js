import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(process.cwd(), 'practices-src'),
  base: './',
  build: {
    outDir: resolve(process.cwd(), '.practices-build'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), 'practices-src/practices.html') }
  }
});
