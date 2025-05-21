import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss(), react()],
  build: {
    outDir: '../../dist/client',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer-motion';
            }
            if (id.includes('zustand')) {
              return 'vendor-zustand';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-react-query';
            }
            if (id.includes('@headlessui') || id.includes('@heroicons')) {
              return 'vendor-ui-kits';
            }
            if (id.includes('react-dropzone')) {
              return 'vendor-react-dropzone';
            }
            if (id.includes('@react-oauth')) {
              return 'vendor-react-oauth';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
