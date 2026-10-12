import { describe, expect, it } from 'vitest'
import { averageRect } from '../../src/core/pixelmap'

// 8×4 RGBA, GL readback order (row 0 = bottom). Left half red, right half blue; top-left pixel white.
function image(): Uint8Array {
  const w = 8
  const h = 4
  const px = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      px.set(x < 4 ? [255, 0, 0, 255] : [0, 0, 255, 255], i)
    }
  px.set([255, 255, 255, 255], ((h - 1) * w + 0) * 4) // top-left in y-down terms
  return px
}

describe('pixel map', () => {
  it('averages across the red/blue boundary', () => {
    const [r, g, b] = averageRect(image(), 8, 4, 0.5, 0.75, 0.25)
    expect(r).toBeCloseTo(0.5)
    expect(g).toBe(0)
    expect(b).toBeCloseTo(0.5)
  })
  it('reads y down, so the top-left corner is the white pixel', () => {
    expect(averageRect(image(), 8, 4, 0.01, 0.01, 0)).toEqual([1, 1, 1])
  })
  it('clamps a rect hanging off the edge', () => {
    expect(averageRect(image(), 8, 4, 1, 0.9, 0.05)).toEqual([0, 0, 1])
  })
})
