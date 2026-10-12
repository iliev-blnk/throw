import type { Browser, BrowserContext, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let ctx: BrowserContext
let op: Page

const stats = (p: Page): Promise<{ luma: number; hash: string }> =>
  p.evaluate(() => (window as any).__throw.stats())

beforeAll(async () => {
  browser = await launch()
  ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  op = await ctx.newPage()
  op.setDefaultTimeout(30_000)
  op.on('pageerror', (e) => console.error('operator pageerror', e.message))
  await op.goto(`${inject('baseUrl')}index.html`)
  await op.evaluate(() => localStorage.clear())
  await op.reload()
  await op.waitForFunction(() => (window as any).__throw?.ready)
})
afterAll(() => browser?.close())

describe('operator', () => {
  it('picking a scene on deck A changes the program', async () => {
    const before = await stats(op)
    await op.click('[data-deck="0"][data-scene="scan"]')
    await op.waitForTimeout(200)
    const after = await stats(op)
    expect(after.hash).not.toBe(before.hash)
    expect(await op.evaluate(() => (window as any).__throw.show().decks[0].scene)).toBe('scan')
  })

  it('an output window shows the same picture as the program', async () => {
    await op.click('[data-deck="0"][data-scene="solid"]')
    await op.fill('[data-param="0-1"]', '0') // solid: no beat dip, so the frame does not depend on time
    const out = await ctx.newPage()
    out.on('pageerror', (e) => console.error('output pageerror', e.message))
    await out.goto(`${inject('baseUrl')}output.html?id=o1`)
    await out.waitForFunction(() => (window as any).__throw?.ready)
    await out.waitForTimeout(500)
    const a = await stats(op)
    const b = await stats(out)
    expect(a.luma).toBeGreaterThan(0.05)
    expect(Math.abs(a.luma - b.luma) / a.luma).toBeLessThan(0.1)
    await out.close()
  })

  it('a blocked microphone says so and the visuals keep running', async () => {
    await op.click('[data-deck="0"][data-scene="smoke"]')
    await op.click('[data-audio="mic"]')
    await op.waitForFunction(() =>
      /microphone blocked/.test(document.querySelector('#audio-status')?.textContent ?? ''),
    )
    const a = await stats(op)
    await op.waitForTimeout(300)
    const b = await stats(op)
    expect(a.hash).not.toBe(b.hash)
  })

  it('blackout key blacks out the program', async () => {
    await op.keyboard.press('b')
    await op.waitForTimeout(100)
    expect((await stats(op)).luma).toBeLessThan(0.005)
    await op.keyboard.press('b')
  })
})
