import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Garante caminhos relativos para funcionar no GitHub Pages (https://jd164.github.io/metereologia/)
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
