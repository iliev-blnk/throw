// Alignment card for one surface: border, grid, diagonals, centre circle, coloured corners, label.

export function drawTestCard(label: string, w = 1024, h = 576): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#666'
  g.lineWidth = 2
  for (let i = 1; i < 8; i++) {
    g.beginPath()
    g.moveTo((w * i) / 8, 0)
    g.lineTo((w * i) / 8, h)
    g.moveTo(0, (h * i) / 8)
    g.lineTo(w, (h * i) / 8)
    g.stroke()
  }
  g.strokeStyle = '#999'
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(w, h)
  g.moveTo(w, 0)
  g.lineTo(0, h)
  g.stroke()
  g.strokeStyle = '#fff'
  g.lineWidth = 6
  g.strokeRect(3, 3, w - 6, h - 6)
  g.beginPath()
  g.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2)
  g.stroke()
  const corner = h * 0.12
  const corners: [number, number, string][] = [
    [0, 0, '#ff3b30'],
    [w, 0, '#34c759'],
    [w, h, '#0a84ff'],
    [0, h, '#ffd60a'],
  ]
  for (const [x, y, color] of corners) {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (x ? -corner : corner), y)
    g.lineTo(x, y + (y ? -corner : corner))
    g.fill()
  }
  g.fillStyle = '#fff'
  g.font = `600 ${Math.round(h * 0.09)}px 'IBM Plex Mono', monospace`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, w / 2, h / 2)
  return c
}
