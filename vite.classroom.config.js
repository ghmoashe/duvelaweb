import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(process.cwd(), 'classroom-src'),
  base: './',
  build: {
    outDir: resolve(process.cwd(), '.classroom-build'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), 'classroom-src/classroom.html') }
  }
});
