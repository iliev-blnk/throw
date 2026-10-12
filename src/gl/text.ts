// Words drawn to a canvas, cropped tight so a scene can stretch them to the frame.

export const DISPLAY_FONT = 'Unbounded'
const SIZE = 360

let ready: Promise<void> | null = null
/** Resolves once the display and UI fonts are loaded (or failed to load, then a fallback face is used). */
export function fontsReady(): Promise<void> {
  ready ??= Promise.all([
    document.fonts.load(`900 ${SIZE}px ${DISPLAY_FONT}`, 'AȘțЖ'),
    document.fonts.load(`600 40px 'IBM Plex Mono'`, 'Output 1'),
  ])
    .then(() => undefined)
    .catch(() => undefined)
  return ready
}

export function renderText(word: string): { canvas: HTMLCanvasElement; aspect: number } {
  const text = word.trim() || ' '
  const font = `900 ${SIZE}px ${DISPLAY_FONT}, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const m = probe.measureText(text)
  const pad = 8
  const w = Math.max(2, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2)
  const h = Math.max(2, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(w, 4096)
  canvas.height = h
  const g = canvas.getContext('2d')!
  g.font = font
  g.fillStyle = '#fff'
  g.textBaseline = 'alphabetic'
  g.setTransform(canvas.width / w, 0, 0, 1, 0, 0)
  g.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent)
  return { canvas, aspect: w / h }
}
