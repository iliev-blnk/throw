import { connect } from 'pagepad/remote'
import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let op: Page
const show = () => op.evaluate(() => (window as any).__throw.show())
const stats = (): Promise<{ luma: number }> => op.evaluate(() => (window as any).__throw.stats())

beforeAll(async () => {
  browser = await launch()
  op = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  op.setDefaultTimeout(10_000)
  op.on('pageerror', (e) => console.error('pageerror', e.message))
  await op.goto(`${inject('baseUrl')}index.html`)
  await op.evaluate(() => localStorage.clear())
  await op.reload()
  await op.waitForFunction(() => (window as any).__throw?.ready)
})
afterAll(() => browser?.close())

describe('looks', () => {
  it('stores a look and recalls it with a number key', async () => {
    await op.click('[data-tab="looks"]')
    await op.selectOption('[data-control="transition"]', '0')
    await op.click('[data-deck="0"][data-scene="grid"]')
    await op.click('[data-store-mode]')
    await op.click('[data-slot="0"]')
    expect((await show()).looks[0].decks[0].scene).toBe('grid')
    await op.click('[data-deck="0"][data-scene="smoke"]')
    await op.keyboard.press('1')
    await op.waitForFunction(() => (window as any).__throw.show().decks[0].scene === 'grid')
  })

  it('autopilot settings land in the show', async () => {
    await op.click('[data-control="autopilot"]')
    await op.selectOption('[data-control="bars"]', '4')
    const s = (await show()).settings.autopilot
    expect(s.on).toBe(true)
    expect(s.bars).toBe(4)
    await op.click('[data-control="autopilot"]')
  })
})

describe('phone remote', () => {
  it('pairs and a phone command blacks out the program', async () => {
    await op.waitForFunction(() => !!(window as any).__throw.remote?.()?.pairUrl)
    const pairUrl: string = await op.evaluate(() => (window as any).__throw.remote().pairUrl)
    const pad = connect(pairUrl)
    await pad.send('blackout', true)
    await op.waitForFunction(() => (window as any).__throw.show().master.blackout === true)
    expect((await stats()).luma).toBeLessThan(0.005)
    await pad.send('blackout', false)
    await op.waitForFunction(() => (window as any).__throw.show().master.blackout === false)
    pad.close()
  })
})
