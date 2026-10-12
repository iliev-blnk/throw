import { createHost, type Host } from 'pagepad/host'
import { defaultParams, SCENES } from '../scenes/index'
import { health } from './lights'
import type { Runtime } from './runtime'
import type { Store } from './store'

const pct = (v: number) => Math.round(v * 100)

/** Phone remote over the server's pagepad relay. Null without a server (the hosted app). */
export async function startRemote(store: Store, rt: Runtime): Promise<Host | null> {
  if (!(await health())) return null
  let host: Host
  try {
    host = await createHost({ endpoint: new URL('api/pad', location.href).href })
  } catch {
    return null
  }
  const scenes = SCENES.map((s) => s.id)
  const stored = () => store.get().looks.flatMap((l, i) => (l ? [String(i + 1)] : []))
  let lastLooks = ''
  const declare = () => {
    const looks = stored()
    lastLooks = looks.join(',')
    host.controls({
      tap: { button: 'Tap' },
      strobe: { button: 'Strobe 2 s' },
      blackout: { toggle: 'Blackout' },
      autopilot: { toggle: 'Autopilot' },
      crossfade: { slider: [0, 100] },
      brightness: { slider: [0, 100] },
      sceneA: { select: scenes },
      sceneB: { select: scenes },
      ...(looks.length ? { look: { select: looks } } : {}),
    })
  }
  declare()

  const setDeck = (deck: 0 | 1, id: unknown) => {
    if (typeof id !== 'string' || !scenes.includes(id)) return
    store.set((s) => {
      const decks = [...s.decks] as typeof s.decks
      decks[deck] = { scene: id, params: defaultParams(id) }
      return { ...s, decks }
    })
  }
  let strobeTimer = 0
  host.on('tap', () => rt.tap())
  host.on('strobe', () => {
    store.set((s) => ({ ...s, master: { ...s.master, strobe: 8 } }))
    clearTimeout(strobeTimer)
    strobeTimer = window.setTimeout(
      () => store.set((s) => ({ ...s, master: { ...s.master, strobe: 0 } })),
      2000,
    )
  })
  host.on('blackout', (v) => store.set((s) => ({ ...s, master: { ...s.master, blackout: v === true } })))
  host.on('autopilot', (v) =>
    store.set((s) => ({
      ...s,
      settings: { ...s.settings, autopilot: { ...s.settings.autopilot, on: v === true } },
    })),
  )
  host.on('crossfade', (v) =>
    store.set((s) => ({ ...s, crossfade: Math.min(1, Math.max(0, Number(v) / 100)) })),
  )
  host.on('brightness', (v) =>
    store.set((s) => ({
      ...s,
      master: { ...s.master, brightness: Math.min(1, Math.max(0, Number(v) / 100)) },
    })),
  )
  host.on('sceneA', (v) => setDeck(0, v))
  host.on('sceneB', (v) => setDeck(1, v))
  host.on('look', (v) => rt.recall(Number(v) - 1))

  let lastState = ''
  const publish = () => {
    if (stored().join(',') !== lastLooks) declare()
    const s = store.get()
    const slot = rt.currentSlot()
    const state = {
      title: 'throw',
      subtitle: `${rt.state.clock.bpm.toFixed(1)} BPM${slot >= 0 ? ` · look ${slot + 1}` : ''}`,
      blackout: s.master.blackout,
      autopilot: s.settings.autopilot.on,
      crossfade: pct(s.crossfade),
      brightness: pct(s.master.brightness),
      sceneA: s.decks[0].scene,
      sceneB: s.decks[1].scene,
      ...(slot >= 0 ? { look: String(slot + 1) } : {}),
    }
    const json = JSON.stringify(state)
    if (json !== lastState) {
      lastState = json
      host.setState(state)
    }
  }
  store.on(publish)
  setInterval(publish, 1000)
  publish()
  return host
}
