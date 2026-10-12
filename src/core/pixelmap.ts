import type { Rgb } from './types'

/**
 * Average colour of an RGBA readback (GL order: row 0 at the bottom) over the square of
 * half-size r around (x, y), all in y-down uv. Clamped to the image; at least one pixel.
 */
export function averageRect(px: Uint8Array, w: number, h: number, x: number, y: number, r: number): Rgb {
  const span = (c: number, n: number): [number, number] => {
    const a = Math.min(n - 1, Math.max(0, Math.floor((c - r) * n)))
    const b = Math.min(n, Math.max(a + 1, Math.ceil((c + r) * n)))
    return [a, b]
  }
  const [x0, x1] = span(x, w)
  const [y0, y1] = span(y, h)
  let rs = 0
  let gs = 0
  let bs = 0
  for (let yd = y0; yd < y1; yd++) {
    const row = h - 1 - yd
    for (let xx = x0; xx < x1; xx++) {
      const i = (row * w + xx) * 4
      rs += px[i]
      gs += px[i + 1]
      bs += px[i + 2]
    }
  }
  const n = (x1 - x0) * (y1 - y0) * 255
  return [rs / n, gs / n, bs / n]
}
