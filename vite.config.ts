import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  loadEnv(mode, '.', '');

  return {
    base: '/My-Mission/',
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});