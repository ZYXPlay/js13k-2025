import { defineConfig } from 'vite';
import { viteZip } from 'vite-plugin-zip-file';
import path from 'path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isJs13k = mode === 'js13k';
  return {
    plugins: [
      viteZip({
        folderPath: path.resolve(__dirname, 'dist'),
        outPath: path.resolve(__dirname),
        zipName: 'game.zip',
        enabled: env.NODE_ENV === 'production' ? true : false,
        withoutMainFolder: true,
      })
    ],
    publicDir: isJs13k ? false : 'public',
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 3,
          toplevel: true,
          ecma: 2020,
        },
        mangle: {
          toplevel: true
        }
      }
    },
    optimizeDeps: {
      force: true,
    },
    define: {
      __JS13K__: JSON.stringify(isJs13k)
    }
  };
});
