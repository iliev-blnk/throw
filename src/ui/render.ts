// Render mode: a frame-exact page for pagereel and for tests.
// render.html?scene=<id>&w=<px>&h=<px>&show=<url>&bpm=<n>
import '../../web/fonts/fonts.css'
import { capture } from '../core/looks'
import { defaultShow, parseShow } from '../core/show'
import type { Clock, Show } from '../core/types'
import { createEngine } from '../gl/engine'
import { fontsReady } from '../gl/text'
import { defaultParams, sceneById } from '../scenes/index'

const q = new URLSearchParams(location.search)
const W = Number(q.get('w')) || 1920
const H = Number(q.get('h')) || 1080
const canvas = document.querySelector('canvas')!
canvas.width = W
canvas.height = H

async function loadShow(): Promise<Show> {
  let show = defaultShow()
  const url = q.get('show')
  if (url) {
    const r = parseShow(await (await fetch(url)).json())
    if (!r.ok) throw new Error(r.error)
    show = r.show
  }
  const scene = q.get('scene')
  if (scene) {
    show.decks[0] = { scene: sceneById(scene).id, params: defaultParams(scene) }
    show.crossfade = 0
  }
  show.settings.masterW = W
  show.settings.masterH = H
  return show
}

const engine = createEngine(canvas, { role: 'render' })
let show: Show = defaultShow()
const clock: Clock = { bpm: Number(q.get('bpm')) || 124, anchor: 0 }

const ready = (async () => {
  show = await loadShow()
  await fontsReady()
})()

function seek(t: number) {
  const beat = ((t - clock.anchor) * clock.bpm) / 60
  engine.frame({
    show,
    look: capture(show),
    t,
    beat: Math.max(0, beat),
    bands: [0, 0, 0, 0],
    pulse: 0,
    view: 'program',
  })
}

const loser = engine.gl.getExtension('WEBGL_lose_context') // must be fetched before the context is lost
const ext = () => loser
;(window as any).pagereel = { duration: 30, fps: 30, width: W, height: H, ready, seek }
;(window as any).__throw = {
  engine,
  loseContext: () => ext()?.loseContext(),
  restoreContext: () => ext()?.restoreContext(),
  contextOk: () => engine.contextOk(),
}
