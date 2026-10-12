import { type Browser, chromium, type Page } from 'playwright-core'

export const CHROMIUM = process.env.THROW_CHROME ?? '/usr/bin/chromium'

export function launch(extraArgs: string[] = []): Promise<Browser> {
  return chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...extraArgs],
  })
}

/** Mean luma (0..1) and a hash of a canvas, sampled at 64×36. */
export async function canvasStats(page: Page, selector = 'canvas'): Promise<{ luma: number; hash: string }> {
  return page.evaluate((sel) => {
    const src = document.querySelector(sel) as HTMLCanvasElement
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 36
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(src, 0, 0, 64, 36)
    const px = g.getImageData(0, 0, 64, 36).data
    let sum = 0
    let h = 2166136261
    for (let i = 0; i < px.length; i += 4) {
      sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
      for (let k = 0; k < 3; k++) h = Math.imul(h ^ px[i + k], 16777619)
    }
    return { luma: sum / (64 * 36), hash: (h >>> 0).toString(16) }
  }, selector)
}
