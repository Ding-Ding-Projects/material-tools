import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Keep test discovery independent of Vite's renderer-only build root.
export default defineConfig({
  plugins: [react()],
  test: {
    include: configDefaults.include.map((pattern) => `src/${pattern}`),
  },
});
