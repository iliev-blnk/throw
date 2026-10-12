import type { Deck, Look, Palette, Show } from './types'

export type Transition = { from: Look; to: Look; start: number; beats: number }

const clone = <T>(v: T): T => structuredClone(v)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const smooth = (u: number) => u * u * (3 - 2 * u)

export function capture(show: Show): Look {
  return clone({
    decks: show.decks,
    crossfade: show.crossfade,
    palette: show.palette,
    master: { brightness: show.master.brightness, hue: show.master.hue },
  })
}

export function applyLook(show: Show, look: Look): Show {
  const l = clone(look)
  return {
    ...show,
    decks: l.decks,
    crossfade: l.crossfade,
    palette: l.palette,
    master: { ...show.master, ...l.master },
  }
}

/** Start a transition from the show's current look on the next whole beat (a 0-beat cut is immediate). */
export function beginTransition(show: Show, to: Look, beat: number, beats: number): Transition {
  const start = beats > 0 ? Math.ceil(beat - 1e-9) : beat
  return { from: capture(show), to: clone(to), start, beats }
}

function lerpHue(a: number, b: number, u: number): number {
  let d = b - a
  if (d > 0.5) d -= 1
  if (d < -0.5) d += 1
  const h = a + d * u
  return ((h % 1) + 1) % 1
}

const lerpPalette = (a: Palette, b: Palette, u: number) =>
  a.map((c, i) => c.map((v, j) => lerp(v, b[i][j], u))) as Palette

function lerpDeck(a: Deck, b: Deck, u: number, swapped: boolean): Deck {
  if (a.scene !== b.scene) return clone(swapped ? b : a)
  return { scene: a.scene, params: a.params.map((p, i) => lerp(p, b.params[i] ?? p, u)) }
}

/**
 * The look at `beat`. Numbers interpolate. A deck whose scene changes is hidden by the crossfade
 * before its scene swaps at the midpoint; if both decks change, the transition fades through black.
 */
export function sample(tr: Transition, beat: number): Look {
  const { from, to } = tr
  if (beat < tr.start) return clone(from)
  const u = tr.beats <= 0 ? 1 : (beat - tr.start) / tr.beats
  if (u >= 1) return clone(to)
  const swapped = u >= 0.5
  const changes = [0, 1].map((i) => from.decks[i].scene !== to.decks[i].scene)

  let crossfade = lerp(from.crossfade, to.crossfade, smooth(u))
  let brightness = lerp(from.master.brightness, to.master.brightness, u)
  if (changes[0] && changes[1]) {
    brightness = swapped
      ? lerp(0, to.master.brightness, smooth(u * 2 - 1))
      : lerp(from.master.brightness, 0, smooth(u * 2))
  } else if (changes[0] || changes[1]) {
    const hidden = changes[0] ? 1 : 0 // deck A is hidden at crossfade 1, deck B at 0
    crossfade = swapped
      ? lerp(hidden, to.crossfade, smooth(u * 2 - 1))
      : lerp(from.crossfade, hidden, smooth(u * 2))
  }

  return {
    decks: [
      lerpDeck(from.decks[0], to.decks[0], u, swapped),
      lerpDeck(from.decks[1], to.decks[1], u, swapped),
    ],
    crossfade,
    palette: lerpPalette(from.palette, to.palette, u),
    master: { brightness, hue: lerpHue(from.master.hue, to.master.hue, u) },
  }
}

/**
 * Autopilot: returns the slot to recall when `beat` crosses a new boundary of `bars` bars
 * (4 beats a bar), else null. `state.last` remembers the last boundary that fired.
 */
export function nextAutopilot(
  state: { last: number },
  beat: number,
  bars: number,
  slots: boolean[],
  current: number,
  random: boolean,
  rng: () => number,
): number | null {
  const boundary = Math.floor((beat + 1e-9) / (bars * 4))
  if (boundary <= state.last) return null
  state.last = boundary
  const stored = slots.flatMap((s, i) => (s ? [i] : []))
  if (!stored.length) return null
  if (random) {
    const others = stored.filter((i) => i !== current)
    const pool = others.length ? others : stored
    return pool[Math.floor(rng() * pool.length) % pool.length]
  }
  return stored.find((i) => i > current) ?? stored[0]
}
