import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let page: Page
const BEAT = 60 / 124

beforeAll(async () => {
  browser = await launch()
  page = await browser.newPage({ viewport: { width: 640, height: 360 } })
  page.setDefaultTimeout(30_000)
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`${inject('baseUrl')}render.html?demo&w=640&h=360&audio=demo/demo.wav`)
  await page.waitForFunction(() => (window as any).__throw?.ready)
  await page.evaluate(() => (window as any).__throw.ready)
})
afterAll(() => browser?.close())

describe('render mode with the demo track', () => {
  it('tells pagereel the track and its length', async () => {
    const reel = await page.evaluate(() => {
      const r = (window as any).pagereel
      return { audio: r.audio, duration: r.duration }
    })
    expect(reel.audio).toMatch(/demo\/demo\.wav$/)
    expect(reel.duration).toBeGreaterThan(30)
    expect(reel.duration).toBeLessThan(31)
  })

  it('has sound in the bands at t=10', async () => {
    const f = await page.evaluate(() => (window as any).__throw.features(10))
    expect(f.level).toBeGreaterThan(0.05)
    expect(f.bass).toBeGreaterThan(0.05)
  })

  it('finds the kicks on the 124 BPM grid', async () => {
    // bars 5–12 have a kick on every beat: onsets land within a frame and a half of the grid
    const onsets: number[] = await page.evaluate(() => {
      const out: number[] = []
      for (let k = 8 * 30; k < 20 * 30; k++)
        if ((window as any).__throw.features(k / 30).onset) out.push(k / 30)
      return out
    })
    const beats = Math.round((20 - 8) / BEAT)
    const onGrid = onsets.filter((t) => {
      const off = t / BEAT - Math.round(t / BEAT)
      return Math.abs(off * BEAT) <= 1.5 / 30
    })
    expect(onGrid.length).toBeGreaterThan(beats * 0.85)
    // hats and claps may add onsets between beats, but not many
    expect(onsets.length).toBeLessThan(beats * 2.5)
  })
})
