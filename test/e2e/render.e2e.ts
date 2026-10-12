import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { canvasStats, launch } from './helpers'

const SCENES = ['raze', 'scan', 'hilbert', 'smoke', 'type', 'grid', 'media', 'solid']
const ANIMATED = ['raze', 'scan', 'hilbert', 'smoke', 'type', 'grid']

let browser: Browser
let page: Page

async function open(scene: string) {
  await page.goto(`${inject('baseUrl')}render.html?scene=${scene}&w=480&h=270`)
  await page.waitForFunction(() => (window as any).pagereel?.ready)
  await page.evaluate(() => (window as any).pagereel.ready)
}
const seek = (t: number) => page.evaluate((x) => (window as any).pagereel.seek(x), t)

beforeAll(async () => {
  browser = await launch()
  page = await browser.newPage()
  page.setDefaultTimeout(10_000)
  page.on('pageerror', (e) => console.error('pageerror', e.message))
})
afterAll(() => browser?.close())

describe('render mode', () => {
  for (const scene of SCENES) {
    it(`${scene} renders a non-black frame`, async () => {
      await open(scene)
      await seek(2)
      expect((await canvasStats(page)).luma).toBeGreaterThan(0.02)
    })
  }

  for (const scene of ANIMATED) {
    it(`${scene} moves between t=1 and t=2`, async () => {
      await open(scene)
      await seek(1)
      const a = await canvasStats(page)
      await seek(2)
      const b = await canvasStats(page)
      expect(a.hash).not.toBe(b.hash)
    })
  }

  it('seeking the same time twice gives the same pixels', async () => {
    await open('raze')
    await seek(1.5)
    const a = await canvasStats(page)
    await seek(3)
    await seek(1.5)
    expect((await canvasStats(page)).hash).toBe(a.hash)
  })

  it('recovers from a lost WebGL context', async () => {
    await open('scan')
    await page.evaluate(() => (window as any).__throw.loseContext())
    await page.waitForTimeout(100)
    await page.evaluate(() => (window as any).__throw.restoreContext())
    await page.waitForFunction(() => (window as any).__throw.contextOk())
    await seek(2)
    expect((await canvasStats(page)).luma).toBeGreaterThan(0.02)
  })
})
