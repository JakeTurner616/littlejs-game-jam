import { defineConfig } from 'vite';
import removeConsole from 'vite-plugin-remove-console';

export default defineConfig(({ mode }) => ({
  base: './',

  plugins: [
    removeConsole({
      // Only remove in production. Keep logs in dev.
      includes: mode === 'production'
        ? ['log', 'warn', 'debug', 'info', 'error']
        : [],
    }),
  ],

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: true,
  },
}));
