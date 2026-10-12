import '../../web/fonts/fonts.css'
import { capture } from '../core/looks'
import { defaultShow } from '../core/show'
import type { Show } from '../core/types'
import { createEngine } from '../gl/engine'
import { createBus, type Live } from '../link/bus'
import { canvasStats } from './debug'
import { imageElement, mediaElement } from './media'
import { loadSaved } from './store'

const id = new URLSearchParams(location.search).get('id') ?? 'o1'
const canvas = document.querySelector('canvas')!
const engine = createEngine(canvas, { role: 'output' })
const bus = createBus()

let show: Show = loadSaved() ?? defaultShow()
let live: (Live & { at: number }) | null = null
let bands: [number, number, number, number] = [0, 0, 0, 0]
let pulse = 0

bus.on(async (m) => {
  if (m.type === 'state') show = m.show
  else if (m.type === 'live') {
    live = { ...m, at: performance.now() }
    bands = m.bands
    pulse = m.pulse
  } else if (m.type === 'media') engine.setMedia(m.deck, m.blob ? await mediaElement(m.blob, m.kind) : null)
  else if (m.type === 'logo') engine.setLogo(m.blob ? await imageElement(m.blob) : null)
})
bus.send({ type: 'hello', role: 'output', id })

function resize() {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(innerWidth * dpr)
  canvas.height = Math.round(innerHeight * dpr)
}
addEventListener('resize', resize)
resize()

function render() {
  const out = show.outputs.find((o) => o.id === id)
  document.title = `throw · ${out?.name ?? id}`
  // the operator's clock, extrapolated; if it has gone quiet, keep running and let the audio decay
  const stale = !live || performance.now() - live.at > 2000
  const t = live ? (performance.timeOrigin + performance.now() - live.epoch) / 1000 : performance.now() / 1000
  if (stale) {
    bands = bands.map((b) => b * 0.9) as typeof bands
    pulse *= 0.9
  }
  const clock = live?.clock ?? { bpm: 120, anchor: 0 }
  const edit = live?.edit?.output === id ? live.edit : null
  document.body.classList.toggle('edit', !!edit)
  engine.frame({
    show,
    look: live && !stale ? live.look : capture(show),
    t,
    beat: Math.max(0, ((t - clock.anchor) * clock.bpm) / 60),
    bands,
    pulse,
    view: 'output',
    outputId: id,
    highlight: edit?.surfaces,
  })
}

function frame() {
  render()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// edit mode: drag the selected surface's corners on the wall
let drag: { surface: string; index: number } | null = null
canvas.addEventListener('pointerdown', (e) => {
  const edit = live?.edit?.output === id ? live.edit : null
  const out = show.outputs.find((o) => o.id === id)
  if (!edit || !out) return
  let best: typeof drag = null
  let bestD = 40
  for (const s of out.surfaces) {
    if (!edit.surfaces.includes(s.id)) continue
    s.corners.forEach(([x, y], i) => {
      const d = Math.hypot(x * innerWidth - e.clientX, y * innerHeight - e.clientY)
      if (d < bestD) {
        bestD = d
        best = { surface: s.id, index: i }
      }
    })
  }
  drag = best
  if (drag) canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return
  const x = e.clientX / innerWidth
  const y = e.clientY / innerHeight
  const surf = show.outputs.find((o) => o.id === id)?.surfaces.find((s) => s.id === drag!.surface)
  if (surf) surf.corners[drag.index] = [x, y] // show the move at once; the operator's state follows
  bus.send({ type: 'corner', output: id, surface: drag.surface, index: drag.index, x, y })
})
canvas.addEventListener('pointerup', () => {
  drag = null
})

addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => undefined)
  }
})

;(window as any).__throw = { ready: true, engine, stats: () => canvasStats(canvas, render) }
