// previs.html: the virtual venue on its own page.
//   ?demo           built-in show on a synthetic 124 BPM clock (for the showcase)
//   (no ?demo)      follows the operator over the bus, like an output window
//   &w=&h=          fixed size (render mode, exposes window.pagereel)
import '../../web/fonts/fonts.css'
import { fixtureValues } from '../core/fixtures'
import { beginTransition, capture, sample } from '../core/looks'
import { strobeGate } from '../core/strobe'
import type { Fixture, Look, Show } from '../core/types'
import { createEngine } from '../gl/engine'
import { type Beam, beamFor, createPrevis } from '../gl/previs'
import { fontsReady } from '../gl/text'
import { createBus, type Live } from '../link/bus'
import { canvasStats } from './debug'
import { demoShow, syntheticBands } from './demo'
import { loadSaved } from './store'

const q = new URLSearchParams(location.search)
const demo = q.has('demo')
const fixedW = Number(q.get('w')) || 0
const fixedH = Number(q.get('h')) || 0
const BPM = 124
const LOOK_BEATS = 16

const canvas = document.querySelector('canvas')!
const engine = createEngine(canvas, { role: fixedW ? 'render' : 'output', readback: true })
const previs = createPrevis(engine.gl)
engine.onRestore(() => previs.restore())

let show: Show = demo ? demoShow() : (loadSaved() ?? demoShow())
let live: (Live & { at: number }) | null = null
let lightsOff = false
const cam = { yaw: 0, pitch: 0, dist: 0 }

if (!demo) {
  const bus = createBus()
  bus.on((m) => {
    if (m.type === 'state') show = m.show
    else if (m.type === 'live') live = { ...m, at: performance.now() }
  })
  bus.send({ type: 'hello', role: 'output', id: 'previs' })
}

/** Demo looks change every 16 beats with a 4-beat transition: a pure function of the beat. */
function demoLook(beat: number): Look {
  const looks = show.looks.filter((l): l is Look => !!l)
  const k = Math.floor(beat / LOOK_BEATS)
  const from = looks[(k + looks.length - 1) % looks.length]
  const to = looks[k % looks.length]
  const base = { ...show, decks: from.decks, crossfade: from.crossfade, palette: from.palette }
  return sample(beginTransition(base, to, k * LOOK_BEATS, 4), beat)
}

function resize() {
  const dpr = fixedW ? 1 : Math.min(devicePixelRatio || 1, 2)
  const w = fixedW || innerWidth
  const h = fixedH || innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
}
addEventListener('resize', resize)
resize()

function render(t: number) {
  let look: Look
  let beat: number
  let bands: [number, number, number, number]
  let pulse: number
  if (demo || !live) {
    beat = (t * BPM) / 60
    look = demo ? demoLook(beat) : capture(show)
    ;({ bands, pulse } = syntheticBands(beat))
  } else {
    const tt = (performance.timeOrigin + performance.now() - live.epoch) / 1000
    beat = Math.max(0, ((tt - live.clock.anchor) * live.clock.bpm) / 60)
    look = live.look
    bands = live.bands
    pulse = live.pulse
    t = tt
  }
  engine.frame({ show, look, t, beat, bands, pulse, view: 'none' })

  const groups = new Map<string, Fixture[]>()
  for (const f of show.fixtures) groups.set(f.group, [...(groups.get(f.group) ?? []), f])
  const inp = {
    pixel: (x: number, y: number) => engine.readPixel(x, y),
    palette: look.palette,
    beat,
    phase: beat - Math.floor(beat),
    level: bands[3],
    dimmer: look.master.brightness,
    blackout: show.master.blackout,
    strobeOpen: strobeGate(show.master.strobe, show.settings.strobeCap, t),
  }
  const beams: Beam[] = lightsOff
    ? []
    : show.fixtures.flatMap((f) => {
        const g = groups.get(f.group)!
        const b = beamFor(f, fixtureValues(f, g.indexOf(f), g.length, inp))
        return b ? [b] : []
      })

  previs.frame({
    program: engine.programTexture(),
    show,
    avg: engine.average(),
    beams,
    camera: {
      yaw: 0.42 * Math.sin(t * 0.06) + cam.yaw,
      pitch: 0.12 + 0.04 * Math.sin(t * 0.045) + cam.pitch,
      dist: 8.4 + 0.7 * Math.sin(t * 0.05) + cam.dist,
    },
    width: canvas.width,
    height: canvas.height,
  })
}

// drag to look around, wheel to move closer
let drag: [number, number] | null = null
canvas.addEventListener('pointerdown', (e) => {
  drag = [e.clientX, e.clientY]
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return
  cam.yaw -= (e.clientX - drag[0]) * 0.005
  cam.pitch = Math.min(0.9, Math.max(-0.15, cam.pitch + (e.clientY - drag[1]) * 0.004))
  drag = [e.clientX, e.clientY]
})
canvas.addEventListener('pointerup', () => {
  drag = null
})
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    cam.dist = Math.min(8, Math.max(-6, cam.dist + e.deltaY * 0.005))
  },
  { passive: false },
)

const ready = fontsReady()
const start = performance.now()
if (!fixedW) {
  const loop = () => {
    render((performance.now() - start) / 1000)
    requestAnimationFrame(loop)
  }
  void ready.then(() => requestAnimationFrame(loop))
}
;(window as any).pagereel = {
  duration: 30,
  fps: 30,
  width: fixedW || 1920,
  height: fixedH || 1080,
  ready,
  seek: (t: number) => render(t),
}
;(window as any).__throw = {
  ready: true,
  stats: () => canvasStats(canvas, () => render((performance.now() - start) / 1000)),
  statsAt: (t: number) => canvasStats(canvas, () => render(t)),
  lightsOff: (v: boolean) => {
    lightsOff = v
  },
}
