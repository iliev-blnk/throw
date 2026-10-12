import type { Fixture, Palette, Pattern, Profile, Rgb } from './types'

export const PROFILE_CHANNELS: Record<Profile, string[]> = {
  rgb: ['r', 'g', 'b'],
  rgbw: ['r', 'g', 'b', 'w'],
  dimmer: ['dimmer'],
  mover: ['pan', 'panFine', 'tilt', 'tiltFine', 'dimmer', 'r', 'g', 'b', 'strobe'],
}

export type LightInput = {
  /** colour of the program at (x, y), y down */
  pixel: (x: number, y: number) => Rgb
  palette: Palette
  /** beats since the clock anchor, fractional */
  beat: number
  phase: number
  level: number
  dimmer: number
  blackout: boolean
  strobeOpen: boolean
}

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function validatePatch(fixtures: Fixture[]): string[] {
  const errors: string[] = []
  const used = new Map<string, string>() // "universe:channel" → fixture name
  for (const f of fixtures) {
    const n = PROFILE_CHANNELS[f.profile].length
    const last = f.address + n - 1
    if (f.address < 1) errors.push(`${f.name}: address must be at least 1`)
    else if (last > 512) errors.push(`${f.name}: channels ${f.address}–${last} run past 512`)
    else {
      for (let ch = f.address; ch <= last; ch++) {
        const owner = used.get(`${f.universe}:${ch}`)
        if (owner) {
          errors.push(`${f.name} overlaps ${owner} at channel ${ch}`)
          break
        }
      }
      for (let ch = f.address; ch <= last; ch++) used.set(`${f.universe}:${ch}`, f.name)
    }
  }
  return errors
}

/** Pan and tilt (0..1) for mover i of n. Patterns run `speed` cycles a bar (4 beats), phase-spread across the group. */
export function moverPanTilt(p: Pattern, beat: number, i: number, n: number): { pan: number; tilt: number } {
  const s = p.size / 2
  const [cx, cy] = p.centre
  const cycle = (beat / 4) * p.speed
  const spread = n > 1 ? i / n : 0
  const th = 2 * Math.PI * (cycle + spread)
  let pan = cx
  let tilt = cy
  switch (p.kind) {
    case 'circle':
      pan = cx + s * Math.cos(th)
      tilt = cy + s * Math.sin(th)
      break
    case 'figure8':
      pan = cx + s * Math.sin(th)
      tilt = cy + (s / 2) * Math.sin(2 * th)
      break
    case 'sweep':
      pan = cx + s * Math.sin(th)
      break
    case 'fan': {
      const pos = n > 1 ? (i / (n - 1)) * 2 - 1 : 0
      pan = cx + s * pos * (0.5 + 0.5 * Math.sin(2 * Math.PI * cycle))
      break
    }
  }
  return { pan: clamp01(pan), tilt: clamp01(tilt) }
}

function colorFor(f: Fixture, i: number, n: number, inp: LightInput): { color: Rgb; intensity: number } {
  if (f.mode === 'pixel') return { color: inp.pixel(f.x, f.y), intensity: 1 }
  if (f.mode === 'beat') {
    const b = Math.floor(inp.beat + 1e-9)
    const active = ((b % n) + n) % n === i
    return { color: inp.palette[Math.floor(b / n) % 3], intensity: active ? 1 - inp.phase * 0.6 : 0 }
  }
  return { color: f.color, intensity: 1 }
}

/** Channel values (0..255) for fixture i of a group of n. */
export function fixtureValues(f: Fixture, i: number, n: number, inp: LightInput): Record<string, number> {
  const { color, intensity } = colorFor(f, i, n, inp)
  const gate = inp.blackout || !inp.strobeOpen ? 0 : inp.dimmer
  const k = gate * intensity
  switch (f.profile) {
    case 'rgb':
      return { r: byte(color[0] * k), g: byte(color[1] * k), b: byte(color[2] * k) }
    case 'rgbw': {
      const w = Math.min(...color)
      return {
        r: byte((color[0] - w) * k),
        g: byte((color[1] - w) * k),
        b: byte((color[2] - w) * k),
        w: byte(w * k),
      }
    }
    case 'dimmer':
      return { dimmer: byte((0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) * k) }
    case 'mover': {
      const { pan, tilt } = f.pattern ? moverPanTilt(f.pattern, inp.beat, i, n) : { pan: 0.5, tilt: 0.5 }
      const p16 = Math.round(pan * 65535)
      const t16 = Math.round(tilt * 65535)
      const lit = k > 0
      return {
        pan: p16 >> 8,
        panFine: p16 & 255,
        tilt: t16 >> 8,
        tiltFine: t16 & 255,
        dimmer: byte(k),
        r: lit ? byte(color[0]) : 0,
        g: lit ? byte(color[1]) : 0,
        b: lit ? byte(color[2]) : 0,
        strobe: 0,
      }
    }
  }
}

/** One 512-byte frame per universe used by the patch. */
export function buildUniverses(fixtures: Fixture[], inp: LightInput): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>()
  const groups = new Map<string, Fixture[]>()
  for (const f of fixtures) groups.set(f.group, [...(groups.get(f.group) ?? []), f])
  for (const f of fixtures) {
    const group = groups.get(f.group)!
    const values = fixtureValues(f, group.indexOf(f), group.length, inp)
    const u = out.get(f.universe) ?? new Uint8Array(512)
    out.set(f.universe, u)
    PROFILE_CHANNELS[f.profile].forEach((name, k) => {
      const ch = f.address - 1 + k
      if (ch >= 0 && ch < 512) u[ch] = values[name] ?? 0
    })
  }
  return out
}
