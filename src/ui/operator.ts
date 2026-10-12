import '../../web/fonts/fonts.css'
import './style.css'
import { defaultShow } from '../core/show'
import { createEngine } from '../gl/engine'
import { createBus } from '../link/bus'
import { canvasStats } from './debug'
import { clear, h } from './h'
import { imageElement, mediaElement } from './media'
import { audioPanel } from './panels/audio'
import { decksPanel, type MediaControl } from './panels/decks'
import { mappingPanel, updateSurface } from './panels/mapping'
import { masterPanel } from './panels/master'
import { toolsPanel } from './panels/tools'
import { createRuntime } from './runtime'
import { createStore, loadSaved } from './store'

export type Tab = { id: string; label: string; el: HTMLElement; frame?(): void }

const store = createStore(loadSaved() ?? defaultShow())
const bus = createBus()
const canvas = h('canvas', { id: 'program' })
const engine = createEngine(canvas, { role: 'operator' })
const rt = createRuntime(store, engine, bus)

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
const decks = decksPanel(store, media)
const master = masterPanel(store, () => rt.toggleBlackout())
const audio = audioPanel(rt)

const mapping = mappingPanel(store, rt)
const tabs: Tab[] = [
  { id: 'audio', label: 'audio', el: audio.el, frame: audio.frame },
  { id: 'outputs', label: 'outputs', el: mapping.el, frame: mapping.frame },
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
  ),
  h(
    'main',
    {},
    h('section', { class: 'stage' }, h('div', { class: 'preview' }, canvas), master.el, decks.el),
    h('aside', {}, tabBar, tabBody),
  ),
)

store.on(() => {
  decks.sync()
  master.sync()
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
  rt.render()
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
  show: () => store.get(),
  stats: () => canvasStats(canvas, () => rt.render()),
}

export { bus, engine, media, rt, store }
