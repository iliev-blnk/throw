import type { Browser, Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { launch } from './helpers'

let browser: Browser
let op: Page

const stats = (p: Page): Promise<{ luma: number; hash: string }> =>
  p.evaluate(() => (window as any).__throw.stats())
const lastSent = (p: Page): Promise<number[][]> =>
  p.evaluate(() =>
    [...(window as any).__throw.lights.lastSent().values()].map((u: Uint8Array) => Array.from(u)),
  )

beforeAll(async () => {
  browser = await launch()
  op = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true })
  ).newPage()
  op.setDefaultTimeout(30_000)
  op.on('pageerror', (e) => console.error('pageerror', e.message))
  await op.goto(`${inject('baseUrl')}index.html`)
  await op.evaluate(() => localStorage.clear())
  await op.reload()
  await op.waitForFunction(() => (window as any).__throw?.ready)
  await op.click('[data-deck="0"][data-scene="scan"]')
  await op.click('[data-tab="show"]')
})
afterAll(() => browser?.close())

describe('show files', () => {
  it('exports the show as show-<date>.json', async () => {
    const [download] = await Promise.all([op.waitForEvent('download'), op.click('[data-show="export"]')])
    expect(download.suggestedFilename()).toMatch(/^show-\d{4}-\d{2}-\d{2}\.json$/)
    const text = await (await download.createReadStream()).toArray()
    const json = JSON.parse(Buffer.concat(text).toString())
    expect(json.version).toBe(1)
    expect(json.decks[0].scene).toBe('scan')
  })

  it('a bad file says why and leaves the show alone', async () => {
    await op.setInputFiles('[data-show="import"]', {
      name: 'next.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":2}'),
    })
    await op.waitForSelector('#show-status.err')
    expect(await op.textContent('#show-status')).toContain('unsupported show version 2')
    expect(await op.evaluate(() => (window as any).__throw.show().decks[0].scene)).toBe('scan')
  })

  it('a good file replaces the show', async () => {
    const show = await op.evaluate(() => (window as any).__throw.show())
    show.decks[0].scene = 'grid'
    await op.setInputFiles('[data-show="import"]', {
      name: 'good.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(show)),
    })
    await op.waitForFunction(() => (window as any).__throw.show().decks[0].scene === 'grid')
    expect(await op.getAttribute('#show-status', 'class')).not.toContain('err')
  })

  it('the strobe cap is clamped to 15 Hz', async () => {
    await op.fill('[data-setting="strobeCap"]', '40')
    await op.dispatchEvent('[data-setting="strobeCap"]', 'change')
    expect(await op.evaluate(() => (window as any).__throw.show().settings.strobeCap)).toBe(15)
    expect(await op.inputValue('[data-setting="strobeCap"]')).toBe('15')
  })

  it('records the program', async () => {
    await op.click('[data-show="record"]')
    await op.waitForTimeout(1200)
    const [download] = await Promise.all([op.waitForEvent('download'), op.click('[data-show="record"]')])
    expect(download.suggestedFilename()).toMatch(/^throw-.*\.(mp4|webm)$/)
    const chunks = await (await download.createReadStream()).toArray()
    expect(Buffer.concat(chunks).length).toBeGreaterThan(1000)
  })
})

describe('panic', () => {
  it('Esc blacks out the program and sends all-zero DMX, movers included', async () => {
    await op.click('[data-deck="0"][data-scene="solid"]')
    await op.fill('[data-param="0-1"]', '0')
    await op.fill('[data-control="crossfade"]', '0')
    await op.click('[data-tab="lights"]')
    await op.click('text=+ 4 RGB pars')
    await op.click('text=+ 4 moving heads')
    await op.waitForTimeout(300)
    const before = await lastSent(op)
    expect(before.flat().some((v) => v > 0)).toBe(true)
    expect((await stats(op)).luma).toBeGreaterThan(0.1)

    await op.keyboard.press('Escape')
    await op.waitForTimeout(300)
    expect((await stats(op)).luma).toBeLessThan(0.005)
    const after = await lastSent(op)
    expect(after.length).toBeGreaterThan(0)
    expect(after.flat().every((v) => v === 0)).toBe(true)
  })

  it('lifting blackout brings the lights back', async () => {
    await op.keyboard.press('b')
    await op.waitForTimeout(300)
    expect((await lastSent(op)).flat().some((v) => v > 0)).toBe(true)
  })
})
