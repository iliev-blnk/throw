import type { Browser, BrowserContext, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let ctx: BrowserContext
let op: Page
let out: Page

type Stats = { luma: number; left: number; right: number; hash: string }
const stats = (p: Page): Promise<Stats> => p.evaluate(() => (window as any).__throw.stats())
const setCorners = (corners: number[][]) =>
  op.evaluate((c) => {
    const st = (window as any).__throw.store
    st.set((s: any) => {
      const outputs = structuredClone(s.outputs)
      outputs[0].surfaces[0].corners = c
      return { ...s, outputs }
    })
  }, corners)
const settle = () => out.waitForTimeout(250)

beforeAll(async () => {
  browser = await launch()
  ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  op = await ctx.newPage()
  op.setDefaultTimeout(30_000)
  await op.goto(`${inject('baseUrl')}index.html`)
  await op.evaluate(() => localStorage.clear())
  await op.reload()
  await op.waitForFunction(() => (window as any).__throw?.ready)
  await op.click('[data-deck="0"][data-scene="solid"]')
  await op.fill('[data-param="0-1"]', '0')
  out = await ctx.newPage()
  await out.setViewportSize({ width: 640, height: 360 })
  out.on('pageerror', (e) => console.error('output pageerror', e.message))
  await out.goto(`${inject('baseUrl')}output.html?id=o1`)
  await out.waitForFunction(() => (window as any).__throw?.ready)
})
afterAll(() => browser?.close())

describe('mapping', () => {
  it('a surface pinned to the right half leaves the left half black', async () => {
    await setCorners([
      [0.55, 0.05],
      [0.95, 0.05],
      [0.95, 0.95],
      [0.55, 0.95],
    ])
    await settle()
    const s = await stats(out)
    expect(s.left).toBeLessThan(0.005)
    expect(s.right).toBeGreaterThan(0.05)
  })

  it('a corner dragged into a bow-tie keeps the last good shape', async () => {
    const before = await stats(out)
    await setCorners([
      [0.55, 0.05],
      [0.55, 0.95],
      [0.95, 0.05],
      [0.95, 0.95],
    ])
    await settle()
    const after = await stats(out)
    expect(after.left).toBeLessThan(0.005)
    expect(Math.abs(after.right - before.right)).toBeLessThan(0.01)
  })

  it('the test card replaces the program when toggled', async () => {
    await op.click('[data-tab="outputs"]')
    const before = await stats(out)
    await op.click('[data-testcard="o1"]')
    await settle()
    const after = await stats(out)
    expect(after.hash).not.toBe(before.hash)
    expect(await op.evaluate(() => (window as any).__throw.show().outputs[0].testCard)).toBe(true)
  })

  it('picking a surface opens the corner editor', async () => {
    await op.click('[data-surface="o1/s1"]')
    await op.waitForSelector('.schematic', { state: 'visible' })
  })

  it('arrow keys nudge the picked corner by one pixel of 1920', async () => {
    const x0 = await op.evaluate(() => (window as any).__throw.show().outputs[0].surfaces[0].corners[0][0])
    await op.focus('.schematic')
    await op.keyboard.press('ArrowRight')
    const x1 = await op.evaluate(() => (window as any).__throw.show().outputs[0].surfaces[0].corners[0][0])
    expect(x1 - x0).toBeCloseTo(1 / 1920, 9)
  })

  it('adding a surface puts it on the output', async () => {
    await op.click('[data-add-surface="o1"]')
    expect(await op.evaluate(() => (window as any).__throw.show().outputs[0].surfaces.length)).toBe(2)
  })
})
