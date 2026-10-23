import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'process'

const isWindows = process.platform === 'win32';
const outDir = isWindows ? 'C:/Users/jimmy/AppData/Local/Temp/mistake-notebook-dist' : 'dist';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: outDir,
    emptyOutDir: true,
    minify: false
  }
})
