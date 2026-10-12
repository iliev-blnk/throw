// Render mode: a frame-exact page for pagereel and for tests.
// render.html?scene=<id>&w=<px>&h=<px>&show=<url>&bpm=<n>&audio=<url>&dur=<s>&demo
//   audio: analyse the track and drive the scenes from it; pagereel muxes it into the video
//   demo:  the demo show with its looks changing every 16 beats
import '../../web/fonts/fonts.css'
import { loadTrack, type Track, trackInput } from '../audio/track'
import { capture } from '../core/looks'
import { defaultShow, parseShow } from '../core/show'
import type { Clock, Show } from '../core/types'
import { createEngine } from '../gl/engine'
import { fontsReady } from '../gl/text'
import { defaultParams, sceneById } from '../scenes/index'
import { DEMO_BPM, demoLook, demoShow } from './demo'

const q = new URLSearchParams(location.search)
const W = Number(q.get('w')) || 1920
const H = Number(q.get('h')) || 1080
const canvas = document.querySelector('canvas')!
canvas.width = W
canvas.height = H

async function loadShow(): Promise<Show> {
  let show = q.has('demo') ? demoShow() : defaultShow()
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
const clock: Clock = { bpm: Number(q.get('bpm')) || DEMO_BPM, anchor: 0 }
const FPS = 30
let track: Track | null = null
const reel = { duration: Number(q.get('dur')) || 30, fps: FPS, width: W, height: H } as Record<
  string,
  unknown
>

const ready = (async () => {
  show = await loadShow()
  const audio = q.get('audio')
  if (audio) {
    track = await loadTrack(audio, FPS)
    reel.audio = track.url
    if (!q.get('dur')) reel.duration = Math.floor(track.duration * FPS) / FPS
  }
  await fontsReady()
})()

function seek(t: number) {
  const beat = Math.max(0, ((t - clock.anchor) * clock.bpm) / 60)
  const audio = track
    ? trackInput(track.table.at(t))
    : { bands: [0, 0, 0, 0] as [number, number, number, number], pulse: 0 }
  engine.frame({
    show,
    look: q.has('demo') ? demoLook(show, beat) : capture(show),
    t,
    beat,
    ...audio,
    view: 'program',
  })
}

const loser = engine.gl.getExtension('WEBGL_lose_context') // must be fetched before the context is lost
const ext = () => loser
;(window as any).pagereel = Object.assign(reel, { ready, seek })
;(window as any).__throw = {
  engine,
  loseContext: () => ext()?.loseContext(),
  restoreContext: () => ext()?.restoreContext(),
  contextOk: () => engine.contextOk(),
  ready,
  features: (t: number) => track?.table.at(t) ?? null,
}
