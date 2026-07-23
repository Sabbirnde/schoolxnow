import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // The new value wins over the legacy fallback; unit tests use their mocked adapter path.
    'import.meta.env.VITE_API_MODE': JSON.stringify('compat-test'),
    'import.meta.env.VITE_BACKEND_PROVIDER': JSON.stringify('php'),
  },
  optimizeDeps: {
    rolldownOptions: {
      commonjsOptions: { transformMixedEsModules: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      'tests/api.integration.test.ts',
      '**/node_modules/**',
      '**/dist/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
