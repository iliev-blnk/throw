import type { Deck, Fixture, Look, Master, Output, Palette, Settings, Show, Surface } from './types'

export const LOOK_SLOTS = 16
export const PARAMS = 8
export const MAX_STROBE = 15

export function defaultSurface(id = 's1'): Surface {
  return {
    id,
    slice: { x: 0, y: 0, w: 1, h: 1 },
    corners: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    feather: 0,
    brightness: 1,
    enabled: true,
  }
}

export function defaultOutput(id = 'o1', name = 'Output 1'): Output {
  return { id, name, surfaces: [defaultSurface()], testCard: false }
}

export function defaultSettings(): Settings {
  return {
    masterW: 1920,
    masterH: 1080,
    sceneScale: 0.75,
    strobeCap: 10,
    transitionBeats: 2,
    autopilot: { on: false, bars: 8, random: false },
    artnetTarget: '2.255.255.255',
    text: 'throw',
    words: ['LIGHT', 'NIGHT', 'SOUND', 'ROOM'],
  }
}

export function defaultShow(): Show {
  return {
    version: 1,
    master: { brightness: 1, blackout: false, strobe: 0, hue: 0 },
    decks: [
      { scene: 'raze', params: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
      { scene: 'scan', params: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    ],
    crossfade: 0,
    palette: [
      [1, 0.62, 0.18],
      [0.18, 0.32, 1],
      [1, 1, 1],
    ],
    looks: Array.from({ length: LOOK_SLOTS }, () => null),
    outputs: [defaultOutput()],
    fixtures: [],
    settings: defaultSettings(),
  }
}

type Result = { ok: true; show: Show } | { ok: false; error: string }

class Invalid extends Error {}

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function num(v: unknown, fallback: number, lo = -Infinity, hi = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}
function oneOf<T>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback
}

function rgb(v: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) return fallback
  return [num(v[0], fallback[0], 0, 1), num(v[1], fallback[1], 0, 1), num(v[2], fallback[2], 0, 1)]
}

function palette(v: unknown, fallback: Palette): Palette {
  if (!Array.isArray(v) || v.length !== 3) return fallback
  return [rgb(v[0], fallback[0]), rgb(v[1], fallback[1]), rgb(v[2], fallback[2])]
}

function master(v: unknown, d: Master): Master {
  if (!isObj(v)) return d
  return {
    brightness: num(v.brightness, d.brightness, 0, 1),
    blackout: bool(v.blackout, d.blackout),
    strobe: num(v.strobe, d.strobe, 0, MAX_STROBE),
    hue: num(v.hue, d.hue, 0, 1),
  }
}

function deck(v: unknown, d: Deck, path: string): Deck {
  if (!isObj(v)) throw new Invalid(`${path} must be an object`)
  const params = Array.isArray(v.params) ? v.params : []
  return {
    scene: str(v.scene, d.scene),
    params: Array.from({ length: PARAMS }, (_, i) => num(params[i], d.params[i] ?? 0.5, 0, 1)),
  }
}

function decks(v: unknown, d: [Deck, Deck], path = 'decks'): [Deck, Deck] {
  if (!Array.isArray(v) || v.length !== 2) throw new Invalid(`${path} must be an array of 2`)
  return [deck(v[0], d[0], `${path}[0]`), deck(v[1], d[1], `${path}[1]`)]
}

function surface(v: unknown, path: string): Surface {
  if (!isObj(v)) throw new Invalid(`${path} must be an object`)
  const d = defaultSurface()
  if (!Array.isArray(v.corners) || v.corners.length !== 4)
    throw new Invalid(`${path}.corners must be 4 points`)
  const corners = v.corners.map((c: unknown, i: number) => {
    if (!Array.isArray(c) || c.length !== 2) throw new Invalid(`${path}.corners[${i}] must be [x, y]`)
    return [num(c[0], 0, -4, 5), num(c[1], 0, -4, 5)]
  }) as Surface['corners']
  const s = isObj(v.slice) ? v.slice : {}
  return {
    id: str(v.id, d.id),
    slice: { x: num(s.x, 0, 0, 1), y: num(s.y, 0, 0, 1), w: num(s.w, 1, 0.001, 1), h: num(s.h, 1, 0.001, 1) },
    corners,
    feather: num(v.feather, 0, 0, 0.5),
    brightness: num(v.brightness, 1, 0, 1),
    enabled: bool(v.enabled, true),
  }
}

function output(v: unknown, i: number): Output {
  const path = `outputs[${i}]`
  if (!isObj(v)) throw new Invalid(`${path} must be an object`)
  if (!Array.isArray(v.surfaces)) throw new Invalid(`${path}.surfaces must be an array`)
  return {
    id: str(v.id, `o${i + 1}`),
    name: str(v.name, `Output ${i + 1}`),
    surfaces: v.surfaces.map((s: unknown, j: number) => surface(s, `${path}.surfaces[${j}]`)),
    testCard: bool(v.testCard, false),
  }
}

function look(v: unknown, d: Show, i: number): Look | null {
  if (v === null || v === undefined) return null
  if (!isObj(v)) throw new Invalid(`looks[${i}] must be an object or null`)
  return {
    decks: decks(v.decks, d.decks, `looks[${i}].decks`),
    crossfade: num(v.crossfade, 0, 0, 1),
    palette: palette(v.palette, d.palette),
    master: {
      brightness: num(v.master?.brightness, 1, 0, 1),
      hue: num(v.master?.hue, 0, 0, 1),
    },
  }
}

const PROFILES = ['rgb', 'rgbw', 'dimmer', 'mover'] as const
const MODES = ['pixel', 'beat', 'static'] as const
const KINDS = ['circle', 'figure8', 'sweep', 'fan'] as const
const SPEEDS = [0.25, 0.5, 1, 2] as const

function fixture(v: unknown, i: number): Fixture {
  if (!isObj(v)) throw new Invalid(`fixtures[${i}] must be an object`)
  const f: Fixture = {
    id: str(v.id, `f${i + 1}`),
    name: str(v.name, `Fixture ${i + 1}`),
    profile: oneOf(v.profile, PROFILES, 'rgb'),
    universe: Math.round(num(v.universe, 0, 0, 32767)),
    address: Math.round(num(v.address, 1, 1, 512)),
    x: num(v.x, 0.5, 0, 1),
    y: num(v.y, 0.5, 0, 1),
    group: str(v.group, 'all'),
    mode: oneOf(v.mode, MODES, 'pixel'),
    color: rgb(v.color, [1, 1, 1]),
  }
  if (isObj(v.pattern)) {
    const p = v.pattern
    f.pattern = {
      kind: oneOf(p.kind, KINDS, 'circle'),
      size: num(p.size, 0.3, 0, 1),
      centre: [num(p.centre?.[0], 0.5, 0, 1), num(p.centre?.[1], 0.5, 0, 1)],
      speed: oneOf(p.speed, SPEEDS, 1),
    }
  }
  return f
}

function settings(v: unknown, d: Settings): Settings {
  if (!isObj(v)) return d
  const ap = isObj(v.autopilot) ? v.autopilot : {}
  return {
    masterW: Math.round(num(v.masterW, d.masterW, 320, 7680)),
    masterH: Math.round(num(v.masterH, d.masterH, 180, 4320)),
    sceneScale: num(v.sceneScale, d.sceneScale, 0.25, 1),
    strobeCap: num(v.strobeCap, d.strobeCap, 0, MAX_STROBE),
    transitionBeats: oneOf(v.transitionBeats, [0, 1, 2, 4, 8] as const, d.transitionBeats),
    autopilot: {
      on: bool(ap.on, d.autopilot.on),
      bars: oneOf(ap.bars, [4, 8, 16] as const, d.autopilot.bars),
      random: bool(ap.random, d.autopilot.random),
    },
    artnetTarget: str(v.artnetTarget, d.artnetTarget),
    text: str(v.text, d.text).slice(0, 40),
    words: Array.isArray(v.words) ? v.words.filter((w) => typeof w === 'string').slice(0, 64) : d.words,
  }
}

/** Validate an untrusted show document (an imported file, localStorage). Missing fields get defaults. */
export function parseShow(json: unknown): Result {
  if (!isObj(json)) return { ok: false, error: 'a show must be a JSON object' }
  if (json.version !== 1) return { ok: false, error: `unsupported show version ${String(json.version)}` }
  const d = defaultShow()
  try {
    const looks = Array.isArray(json.looks) ? json.looks.slice(0, LOOK_SLOTS) : []
    const show: Show = {
      version: 1,
      master: master(json.master, d.master),
      decks: json.decks === undefined ? d.decks : decks(json.decks, d.decks),
      crossfade: num(json.crossfade, 0, 0, 1),
      palette: palette(json.palette, d.palette),
      looks: Array.from({ length: LOOK_SLOTS }, (_, i) => look(looks[i], d, i)),
      outputs: Array.isArray(json.outputs) ? json.outputs.map(output) : d.outputs,
      fixtures: Array.isArray(json.fixtures) ? json.fixtures.map(fixture) : [],
      settings: settings(json.settings, d.settings),
    }
    return { ok: true, show }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message }
    throw e
  }
}
