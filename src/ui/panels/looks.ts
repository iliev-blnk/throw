import { capture } from '../../core/looks'
import type { Settings } from '../../core/types'
import { h } from '../h'
import type { Runtime } from '../runtime'
import type { Store } from '../store'

/** 16 look slots, the transition length and autopilot. */
export function looksPanel(store: Store, rt: Runtime): { el: HTMLElement; frame(): void } {
  let storing = false
  const storeBtn = h('button', {
    text: 'store',
    'data-store-mode': '',
    onclick: () => {
      storing = !storing
      sync()
    },
  })
  const slots = Array.from({ length: 16 }, (_, i) =>
    h('button', {
      class: 'slot',
      'data-slot': i,
      onclick: (e: MouseEvent) => {
        if (storing || e.shiftKey) {
          const look = capture(store.get())
          store.set((s) => ({ ...s, looks: s.looks.map((l, j) => (j === i ? look : l)) }))
          storing = false
        } else rt.recall(i)
        sync()
      },
    }),
  )
  const clearBtn = h('button', {
    text: 'clear all',
    onclick: () => {
      if (confirm('Clear all 16 looks?')) store.set((s) => ({ ...s, looks: s.looks.map(() => null) }))
    },
  })
  const setSettings = (patch: Partial<Settings>) =>
    store.set((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  const transition = h(
    'select',
    {
      'data-control': 'transition',
      onchange: () =>
        setSettings({ transitionBeats: Number(transition.value) as Settings['transitionBeats'] }),
    },
    ...[0, 1, 2, 4, 8].map((b) =>
      h('option', { value: String(b), text: b ? `${b} beat${b > 1 ? 's' : ''}` : 'cut' }),
    ),
  )
  const autopilot = h('button', {
    text: 'autopilot',
    'data-control': 'autopilot',
    onclick: () => {
      const ap = store.get().settings.autopilot
      setSettings({ autopilot: { ...ap, on: !ap.on } })
    },
  })
  const bars = h(
    'select',
    {
      'data-control': 'bars',
      onchange: () =>
        setSettings({
          autopilot: { ...store.get().settings.autopilot, bars: Number(bars.value) as 4 | 8 | 16 },
        }),
    },
    ...[4, 8, 16].map((b) => h('option', { value: String(b), text: `every ${b} bars` })),
  )
  const random = h('input', {
    type: 'checkbox',
    onchange: () => setSettings({ autopilot: { ...store.get().settings.autopilot, random: random.checked } }),
  })

  function sync() {
    const s = store.get()
    storeBtn.classList.toggle('on', storing)
    slots.forEach((b, i) => {
      const l = s.looks[i]
      b.textContent = l
        ? `${i + 1} ${l.decks[0].scene}${l.crossfade > 0.5 ? ` → ${l.decks[1].scene}` : ''}`
        : `${i + 1} ·`
      b.classList.toggle('empty', !l)
      b.classList.toggle('on', rt.currentSlot() === i)
    })
    if (document.activeElement !== transition) transition.value = String(s.settings.transitionBeats)
    autopilot.classList.toggle('on', s.settings.autopilot.on)
    bars.value = String(s.settings.autopilot.bars)
    random.checked = s.settings.autopilot.random
  }
  store.on(sync)
  sync()

  let last = -2
  return {
    el: h(
      'div',
      { class: 'panel looks' },
      h('p', {
        class: 'status',
        text: 'Press store, then a slot, to save what is on screen. Keys 1–9 recall.',
      }),
      h('div', { class: 'row' }, storeBtn, clearBtn),
      h('div', { class: 'slots' }, ...slots),
      h('label', { class: 'field inline' }, h('span', { class: 'name', text: 'transition' }), transition),
      h('div', { class: 'row' }, autopilot, bars, h('label', { class: 'check' }, random, ' random order')),
    ),
    frame() {
      if (rt.currentSlot() !== last) {
        last = rt.currentSlot()
        sync()
      }
    },
  }
}
