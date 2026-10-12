// Render every scene to <out>/<scene>.png at time t: node scripts/stills.mjs <out> <t>. Run after pnpm build.
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const server = await preview({ preview: { port: 0 }, logLevel: 'warn' })
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
const out = process.argv[2] ?? 'stills'
const t = Number(process.argv[3] ?? 5)
for (const s of ['raze', 'scan', 'hilbert', 'smoke', 'type', 'grid', 'media', 'solid']) {
  await page.goto(`${url}render.html?scene=${s}&w=640&h=360`)
  await page.waitForFunction(() => window.pagereel?.ready)
  await page.evaluate(() => window.pagereel.ready)
  await page.evaluate((x) => window.pagereel.seek(x), t)
  await page.locator('canvas').screenshot({ path: `${out}/${s}.png` })
}
await browser.close()
await server.close()
