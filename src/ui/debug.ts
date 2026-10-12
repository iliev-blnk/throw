// Test hooks: mean luma and a hash of a WebGL canvas, read right after a synchronous render.

export type Stats = { luma: number; left: number; right: number; hash: string }

export function canvasStats(canvas: HTMLCanvasElement, render: () => void): Stats {
  render()
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 36
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(canvas, 0, 0, 64, 36)
  const px = g.getImageData(0, 0, 64, 36).data
  let sum = 0
  let left = 0
  let right = 0
  let h = 2166136261
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
    sum += l
    if ((i / 4) % 64 < 30) left += l
    else if ((i / 4) % 64 >= 34) right += l
    for (let k = 0; k < 3; k++) h = Math.imul(h ^ px[i + k], 16777619)
  }
  const n = 64 * 36
  return { luma: sum / n, left: left / (30 * 36), right: right / (30 * 36), hash: (h >>> 0).toString(16) }
}
