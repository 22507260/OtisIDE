/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Tests cover pure logic, so Node is enough; the setup file supplies the
    // one browser global the simulation runtime reaches for.
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'electron/**/*.test.js'],
    // The runtime tests let a sketch actually run for a couple of seconds, so
    // the default five second budget is too tight on a busy CI runner.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
