import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // 🔥 forces relative asset URLs
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
