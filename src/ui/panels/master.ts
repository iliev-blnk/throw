import { MAX_STROBE } from '../../core/show'
import { h, slider } from '../h'
import type { Store } from '../store'

export function masterPanel(store: Store, toggleBlackout: () => void): { el: HTMLElement; sync(): void } {
  const m = (patch: Partial<ReturnType<Store['get']>['master']>) =>
    store.set((s) => ({ ...s, master: { ...s.master, ...patch } }))
  const parts = [
    slider('A ↔ B', {
      get: () => store.get().crossfade,
      set: (v) => store.set((s) => ({ ...s, crossfade: v })),
      attrs: { 'data-control': 'crossfade' },
    }),
    slider('brightness', { get: () => store.get().master.brightness, set: (v) => m({ brightness: v }) }),
    slider('hue', { get: () => store.get().master.hue, set: (v) => m({ hue: v }) }),
    slider('strobe Hz', {
      min: 0,
      max: MAX_STROBE,
      step: 0.5,
      get: () => store.get().master.strobe,
      set: (v) => m({ strobe: v }),
    }),
  ]
  const blackout = h('button', { class: 'blackout', text: 'blackout (B)', onclick: toggleBlackout })
  const sync = () => {
    for (const p of parts) p.sync()
    blackout.classList.toggle('on', store.get().master.blackout)
  }
  sync()
  return { el: h('div', { class: 'master' }, ...parts.map((p) => p.el), blackout), sync }
}
