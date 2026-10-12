import '../../web/fonts/fonts.css'
import './style.css'
import { defaultShow } from '../core/show'
import { createEngine } from '../gl/engine'
import { beamFor, createPrevis } from '../gl/previs'
import { createBus } from '../link/bus'
import { canvasStats } from './debug'
import { clear, h } from './h'
import { createLights } from './lights'
import { imageElement, mediaElement } from './media'
import { audioPanel } from './panels/audio'
import { decksPanel, type MediaControl } from './panels/decks'
import { lightsPanel } from './panels/lights'
import { looksPanel } from './panels/looks'
import { mappingPanel, updateSurface } from './panels/mapping'
import { masterPanel } from './panels/master'
import { remotePanel } from './panels/remote'
import { showPanel } from './panels/show'
import { toolsPanel } from './panels/tools'
import { startRemote } from './remote'
import { createRuntime } from './runtime'
import { createStore, loadSaved } from './store'

export type Tab = { id: string; label: string; el: HTMLElement; frame?(): void }

const store = createStore(loadSaved() ?? defaultShow())
const bus = createBus()
const canvas = h('canvas', { id: 'program' })
const engine = createEngine(canvas, { role: 'operator' })
const rt = createRuntime(store, engine, bus)
const previs = createPrevis(engine.gl)
engine.onRestore(() => previs.restore())
let view: 'program' | 'previs' = 'program'
const lights = createLights(store, engine, rt)
let remote: Awaited<ReturnType<typeof startRemote>> | undefined
void startRemote(store, rt).then((r) => {
  remote = r
})
rt.onPanic(() => lights.panic())

// media files live here; outputs get them over the bus
const blobs: {
  media: [{ blob: Blob; kind: 'video' | 'image' } | null, { blob: Blob; kind: 'video' | 'image' } | null]
  logo: Blob | null
} = {
  media: [null, null],
  logo: null,
}
const media: MediaControl = {
  async setMedia(deck, file) {
    const kind = file?.type.startsWith('image') ? 'image' : 'video'
    blobs.media[deck] = file ? { blob: file, kind } : null
    engine.setMedia(deck, file ? await mediaElement(file, kind) : null)
    bus.send({ type: 'media', deck, blob: file, kind })
  },
  async setLogo(file) {
    blobs.logo = file
    engine.setLogo(file ? await imageElement(file) : null)
    bus.send({ type: 'logo', blob: file })
  },
}

// corners dragged on the wall, in an output window
bus.on((m) => {
  if (m.type !== 'corner') return
  updateSurface(store, m.output, m.surface, (s) => {
    s.corners[m.index] = [m.x, m.y]
    return s
  })
})

// outputs ask for everything when they open
bus.on((m) => {
  if (m.type !== 'hello' || m.role !== 'output') return
  bus.send({ type: 'state', show: store.get() })
  blobs.media.forEach((b, deck) => {
    if (b) bus.send({ type: 'media', deck: deck as 0 | 1, blob: b.blob, kind: b.kind })
  })
  if (blobs.logo) bus.send({ type: 'logo', blob: blobs.logo })
})
let stateTimer = 0
store.on((show) => {
  clearTimeout(stateTimer)
  stateTimer = window.setTimeout(() => bus.send({ type: 'state', show }), 30)
})

// ── layout ──────────────────────────────────────────────
const beatDots = [0, 1, 2, 3].map(() => h('i'))
const bpmLabel = h('span', { class: 'bpm' })
const serverLabel = h('span', { class: 'server' })
const viewButtons = (['program', 'previs'] as const).map((v) =>
  h('button', {
    text: v,
    'data-view': v,
    class: v === view ? 'on' : '',
    onclick: () => {
      view = v
      for (const b of viewButtons) b.classList.toggle('on', b.dataset.view === v)
    },
  }),
)
const decks = decksPanel(store, media)
const master = masterPanel(store, () => rt.toggleBlackout())
const audio = audioPanel(rt)

const mapping = mappingPanel(store, rt)
const showTabPanel = showPanel(store, canvas, () => rt.panic())
const tabs: Tab[] = [
  { id: 'audio', label: 'audio', el: audio.el, frame: audio.frame },
  { id: 'outputs', label: 'outputs', el: mapping.el, frame: mapping.frame },
  { id: 'looks', label: 'looks', ...looksPanel(store, rt) },
  { id: 'lights', label: 'lights', ...lightsPanel(store, lights) },
  { id: 'remote', label: 'remote', ...remotePanel(() => remote) },
  { id: 'show', label: 'show', el: showTabPanel.el, frame: showTabPanel.frame },
  { id: 'tools', label: 'tools', el: toolsPanel() },
]
const tabBar = h('nav', { class: 'tabs' })
const tabBody = h('div', { class: 'tabbody' })
let current = 'audio'
function showTab(id: string) {
  current = id
  for (const b of tabBar.children)
    (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.tab === id)
  clear(tabBody)
  const t = tabs.find((x) => x.id === id)
  if (t) tabBody.append(t.el)
}
export function addTab(tab: Tab) {
  tabs.push(tab)
  renderTabs()
}
function renderTabs() {
  tabBar.replaceChildren(
    ...tabs.map((t) => h('button', { text: t.label, 'data-tab': t.id, onclick: () => showTab(t.id) })),
  )
  showTab(current)
}
renderTabs()

document.body.append(
  h(
    'header',
    {},
    h('strong', { text: 'throw' }),
    bpmLabel,
    h('span', { class: 'beats' }, ...beatDots),
    h('button', { text: 'tap', onclick: () => rt.tap() }),
    h('button', { text: 'beat 1', onclick: () => rt.resync() }),
    serverLabel,
    h('button', { class: 'blackout on', text: 'panic', title: 'Esc', onclick: () => rt.panic() }),
  ),
  h(
    'main',
    {},
    h(
      'section',
      { class: 'stage' },
      h('div', { class: 'row views' }, ...viewButtons),
      h('div', { class: 'preview' }, canvas),
      master.el,
      decks.el,
    ),
    h('aside', {}, tabBar, tabBody),
  ),
)

store.on(() => {
  decks.sync()
  master.sync()
  showTabPanel.sync()
})

// ── keys ────────────────────────────────────────────────
const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  return (
    t.tagName === 'TEXTAREA' ||
    (t.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes((t as HTMLInputElement).type))
  )
}
window.addEventListener('keydown', (e) => {
  if (typing(e) || e.repeat) return
  if (e.code === 'Space') {
    e.preventDefault()
    rt.tap()
  } else if (e.key === 'Enter') rt.resync()
  else if (e.key === 'b' || e.key === 'B') rt.toggleBlackout()
  else if (e.key === 'Escape') rt.panic()
  else if (/^[1-9]$/.test(e.key)) rt.recall(Number(e.key) - 1)
})

// ── frame loop ──────────────────────────────────────────
function resize() {
  const r = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(2, Math.round(r.width * dpr))
  canvas.height = Math.max(2, Math.round(r.height * dpr))
}
new ResizeObserver(resize).observe(canvas)
resize()

function frame() {
  rt.state.edit = null // the outputs tab sets it again while it is open
  tabs.find((t) => t.id === current)?.frame?.()
  rt.step()
  if (view === 'previs') {
    rt.render('none')
    lights.frame()
    previs.frame({
      program: engine.programTexture(),
      show: store.get(),
      avg: engine.average(),
      beams: store.get().fixtures.flatMap((f) => {
        const v = lights.values(f.id)
        const b = v && beamFor(f, v)
        return b ? [b] : []
      }),
      camera: { yaw: 0.35 * Math.sin(rt.state.t * 0.06), pitch: 0.14, dist: 7.2 },
      width: canvas.width,
      height: canvas.height,
    })
  } else {
    rt.render()
    lights.frame()
  }
  serverLabel.textContent = {
    checking: '',
    none: 'no server',
    offline: 'server offline',
    online: 'server online',
  }[lights.status()]
  const b = rt.state.beat
  bpmLabel.textContent = `${rt.state.clock.bpm.toFixed(1)} BPM`
  beatDots.forEach((d, i) => {
    d.classList.toggle('on', Math.floor(b) % 4 === i)
  })
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
bus.send({ type: 'state', show: store.get() })

;(window as any).__throw = {
  ready: true,
  store,
  engine,
  runtime: rt,
  lights,
  remote: () => remote,
  show: () => store.get(),
  stats: () => canvasStats(canvas, () => rt.render()),
}

export { bus, engine, media, rt, store }
