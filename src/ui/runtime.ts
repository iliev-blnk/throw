import { type LiveAudio, silentAudio, startLive } from '../audio/live'
import { applyLook, beginTransition, capture, nextAutopilot, sample, type Transition } from '../core/looks'
import { beats as beatCount, createTapper, estimateTempo, nudge, resync, setBpm } from '../core/tempo'
import type { Clock, Features, Look } from '../core/types'
import type { Engine } from '../gl/engine'
import type { createBus, Live } from '../link/bus'
import type { Store } from './store'

const ENV = 480 // 8 s of onset strength at 60 steps a second

export type Runtime = ReturnType<typeof createRuntime>

/** Everything that changes every frame on the operator: clock, audio, transitions, autopilot. */
export function createRuntime(store: Store, engine: Engine, bus: ReturnType<typeof createBus>) {
  const epoch = performance.timeOrigin
  const now = () => (performance.timeOrigin + performance.now() - epoch) / 1000
  const tapper = createTapper()
  const env = new Float32Array(ENV)
  let envPos = 0
  let candidate: number | null = null
  const auto = { state: { last: 0 }, slot: -1 }

  const r = {
    clock: { bpm: 120, anchor: 0 } as Clock,
    auto: true,
    audio: silentAudio('no audio input') as LiveAudio,
    features: { bass: 0, mid: 0, high: 0, level: 0, flux: 0, onset: false, pulse: 0 } as Features,
    look: capture(store.get()) as Look,
    transition: null as Transition | null,
    t: 0,
    beat: 0,
    edit: null as Live['edit'],
    frameHooks: new Set<() => void>(),
  }

  const beatAt = (t: number) => ((t - r.clock.anchor) * r.clock.bpm) / 60
  const panicHooks = new Set<() => void>()

  /** Recall a look slot with the show's transition length. */
  function recall(slot: number): boolean {
    const look = store.get().looks[slot]
    if (!look) return false
    r.transition = beginTransition(store.get(), look, r.beat, store.get().settings.transitionBeats)
    auto.slot = slot
    return true
  }

  const api = {
    get state() {
      return r
    },
    now,
    epoch,
    tap() {
      const bpm = tapper.tap(now())
      if (bpm) r.clock = setBpm(r.clock, now(), Math.round(bpm * 10) / 10)
    },
    resync: () => {
      r.clock = resync(r.clock, now())
      auto.state.last = 0
    },
    setBpm: (bpm: number) => {
      r.clock = setBpm(r.clock, now(), Math.min(200, Math.max(40, bpm)))
    },
    setAuto: (on: boolean) => {
      r.auto = on
    },
    async setAudio(opts: { deviceId?: string; file?: File } | null) {
      r.audio.stop()
      r.audio = opts ? await startLive(opts) : silentAudio('no audio input')
      return r.audio.status
    },
    recall,
    currentSlot: () => auto.slot,
    toggleBlackout() {
      store.set((s) => ({ ...s, master: { ...s.master, blackout: !s.master.blackout } }))
    },
    panic() {
      store.set((s) => ({ ...s, master: { ...s.master, blackout: true, strobe: 0 } }))
      for (const h of panicHooks) h()
    },
    onPanic(h: () => void) {
      panicHooks.add(h)
    },
    onFrame(h: () => void) {
      r.frameHooks.add(h)
    },
    /** Advance one frame: audio, tempo, transitions, autopilot. Returns the live message. */
    step(): Live {
      const t = now()
      r.t = t
      const f = r.audio.features(t)
      r.features = f
      env[envPos++ % ENV] = f.flux
      if (r.auto && f.onset) r.clock = nudge(r.clock, t, t)
      if (r.auto && envPos % 120 === 0 && envPos >= ENV / 2 && r.audio.source !== 'none') {
        const ordered = Float32Array.from({ length: ENV }, (_, i) => env[(envPos + i) % ENV])
        const bpm = estimateTempo(ordered, 60)
        if (bpm && Math.abs(bpm - r.clock.bpm) > 1) {
          if (candidate && Math.abs(candidate - bpm) < 1)
            r.clock = setBpm(r.clock, t, Math.round(bpm * 10) / 10)
          candidate = bpm
        } else candidate = null
      }
      r.beat = Math.max(0, beatAt(t))

      const show = store.get()
      if (r.transition) {
        r.look = sample(r.transition, r.beat)
        if (r.beat >= r.transition.start + r.transition.beats) {
          const to = r.transition.to
          r.transition = null
          store.set((s) => applyLook(s, to))
          r.look = capture(store.get())
        }
      } else r.look = capture(show)

      const ap = show.settings.autopilot
      if (ap.on && !r.transition) {
        const slot = nextAutopilot(
          auto.state,
          beatCount(r.clock, t),
          ap.bars,
          show.looks.map((l) => !!l),
          auto.slot,
          ap.random,
          Math.random,
        )
        if (slot !== null) recall(slot)
      } else auto.state.last = Math.floor(beatCount(r.clock, t) / (ap.bars * 4))

      const live: Live = {
        epoch,
        t,
        clock: r.clock,
        bands: [f.bass, f.mid, f.high, f.level],
        pulse: f.pulse,
        look: r.look,
        edit: r.edit,
      }
      bus.send({ type: 'live', ...live })
      for (const h of r.frameHooks) h()
      return live
    },
    render(view: 'program' | 'none' = 'program') {
      engine.frame({
        show: store.get(),
        look: r.look,
        t: r.t,
        beat: r.beat,
        bands: [r.features.bass, r.features.mid, r.features.high, r.features.level],
        pulse: r.features.pulse,
        view,
      })
    },
  }
  return api
}
