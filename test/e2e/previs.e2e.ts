import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let page: Page
const statsAt = (t: number): Promise<{ luma: number }> =>
  page.evaluate((x) => (window as any).__throw.statsAt(x), t)

beforeAll(async () => {
  browser = await launch()
  page = await browser.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`${inject('baseUrl')}previs.html?demo&w=640&h=360`)
  await page.waitForFunction(() => (window as any).__throw?.ready)
  await page.evaluate(() => (window as any).pagereel.ready)
})
afterAll(() => browser?.close())

describe('previs', () => {
  it('renders the demo room', async () => {
    expect((await statsAt(8)).luma).toBeGreaterThan(0.02)
  })

  it('the moving-head beams add light', async () => {
    const on = await statsAt(8)
    await page.evaluate(() => (window as any).__throw.lightsOff(true))
    const off = await statsAt(8)
    await page.evaluate(() => (window as any).__throw.lightsOff(false))
    expect(on.luma - off.luma).toBeGreaterThan(0.003)
  })

  it('is deterministic for render mode', async () => {
    const a = await page.evaluate(() => (window as any).__throw.statsAt(5.5))
    await statsAt(9)
    const b = await page.evaluate(() => (window as any).__throw.statsAt(5.5))
    expect(b.hash).toBe(a.hash)
  })
})
