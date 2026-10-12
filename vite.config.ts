import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Every .html file in web/ is a page.
const pages = Object.fromEntries(
  readdirSync(resolve(import.meta.dirname, 'web'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(import.meta.dirname, 'web', f)]),
)

export default defineConfig({
  root: 'web',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, rollupOptions: { input: pages } },
  server: { port: 5173 },
})
