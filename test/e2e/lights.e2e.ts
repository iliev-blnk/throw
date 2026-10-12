import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let op: Page

beforeAll(async () => {
  browser = await launch()
  op = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  op.setDefaultTimeout(30_000)
  op.on('pageerror', (e) => console.error('pageerror', e.message))
  await op.goto(`${inject('baseUrl')}index.html`)
  await op.evaluate(() => localStorage.clear())
  await op.reload()
  await op.waitForFunction(() => (window as any).__throw?.ready)
})
afterAll(() => browser?.close())

describe('lights', () => {
  it('finds the server and goes online', async () => {
    await op.waitForFunction(() => (window as any).__throw.lights.status() === 'online')
  })

  it('pars in pixel mode send the colour of the picture', async () => {
    await op.click('[data-deck="0"][data-scene="solid"]')
    await op.fill('[data-param="0-1"]', '0')
    await op.click('[data-tab="lights"]')
    await op.click('text=+ 4 RGB pars')
    await op.waitForTimeout(300)
    const u = await op.evaluate(() => Array.from((window as any).__throw.lights.lastSent().get(0) ?? []))
    // solid uses palette[0] = (1, 0.62, 0.18): the first par's red is high, blue low
    expect(u[0]).toBeGreaterThan(200)
    expect(u[2]).toBeLessThan(80)
  })

  it('blackout zeros the pars', async () => {
    await op.keyboard.press('b')
    await op.waitForTimeout(150)
    const u = await op.evaluate(() => Array.from((window as any).__throw.lights.lastSent().get(0) ?? []))
    expect(u.slice(0, 12).every((v) => v === 0)).toBe(true)
    await op.keyboard.press('b')
  })
})
