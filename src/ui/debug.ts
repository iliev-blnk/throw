// Test hooks: mean luma and a hash of a WebGL canvas, read right after a synchronous render.

export function canvasStats(canvas: HTMLCanvasElement, render: () => void): { luma: number; hash: string } {
  render()
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 36
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(canvas, 0, 0, 64, 36)
  const px = g.getImageData(0, 0, 64, 36).data
  let sum = 0
  let h = 2166136261
  for (let i = 0; i < px.length; i += 4) {
    sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
    for (let k = 0; k < 3; k++) h = Math.imul(h ^ px[i + k], 16777619)
  }
  return { luma: sum / (64 * 36), hash: (h >>> 0).toString(16) }
}
