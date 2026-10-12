// Screenshot a page of the built app: node scripts/shot.mjs <page> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const [page = 'index.html', out = 'shot.png', w = '1440', h = '900', wait = '1500'] = process.argv.slice(2)
const server = await preview({ preview: { port: 0 }, logLevel: 'warn' })
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } })
p.on('pageerror', (e) => console.error('pageerror', e.message))
await p.goto(server.resolvedUrls.local[0] + page)
await p.waitForTimeout(Number(wait))
await p.screenshot({ path: out })
await browser.close()
await server.close()
