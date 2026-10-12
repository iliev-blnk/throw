// One frame of a page in render mode: node scripts/still.mjs "<page?query>" <t> <out.png>. Run after pnpm build.
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const [page, t = '8', out = 'still.png'] = process.argv.slice(2)
const server = await preview({ preview: { port: 0 }, logLevel: 'warn' })
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await browser.newPage()
p.on('pageerror', (e) => console.error('pageerror', e.message))
await p.goto(server.resolvedUrls.local[0] + page)
await p.waitForFunction(() => window.pagereel?.ready)
await p.evaluate(() => window.pagereel.ready)
const { width, height } = await p.evaluate(() => ({
  width: window.pagereel.width,
  height: window.pagereel.height,
}))
await p.setViewportSize({ width, height })
await p.evaluate((x) => window.pagereel.seek(x), Number(t))
await p.locator('canvas').screenshot({ path: out })
await browser.close()
await server.close()
