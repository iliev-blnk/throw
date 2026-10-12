// Shared types for the whole app. Everything in src/core is pure TS with no DOM.

export type Vec2 = [number, number]
export type Rgb = [number, number, number]
export type Rect = { x: number; y: number; w: number; h: number }
export type Palette = [Rgb, Rgb, Rgb]

export type Master = {
  brightness: number
  blackout: boolean
  /** strobe rate in Hz, 0 = off */
  strobe: number
  /** hue rotation, 0..1 of a turn */
  hue: number
}

export type Deck = { scene: string; params: number[] }

export type Surface = {
  id: string
  /** the part of the program this surface shows, in program uv (0..1, y down) */
  slice: Rect
  /** where the slice lands on the output, TL, TR, BR, BL, in output uv (0..1, y down) */
  corners: [Vec2, Vec2, Vec2, Vec2]
  feather: number
  brightness: number
  enabled: boolean
}

export type Output = { id: string; name: string; surfaces: Surface[]; testCard: boolean }

export type Look = {
  decks: [Deck, Deck]
  crossfade: number
  palette: Palette
  master: Pick<Master, 'brightness' | 'hue'>
}

export type Profile = 'rgb' | 'rgbw' | 'dimmer' | 'mover'
export type PatternKind = 'circle' | 'figure8' | 'sweep' | 'fan'
export type Pattern = { kind: PatternKind; size: number; centre: Vec2; speed: 0.25 | 0.5 | 1 | 2 }

export type Fixture = {
  id: string
  name: string
  profile: Profile
  universe: number
  /** DMX start address, 1..512 */
  address: number
  /** position on the program for pixel mapping, 0..1, y down */
  x: number
  y: number
  group: string
  mode: 'pixel' | 'beat' | 'static'
  color: Rgb
  pattern?: Pattern
}

export type Settings = {
  masterW: number
  masterH: number
  sceneScale: number
  strobeCap: number
  transitionBeats: 0 | 1 | 2 | 4 | 8
  autopilot: { on: boolean; bars: 4 | 8 | 16; random: boolean }
  artnetTarget: string
  /** occluder word for raze */
  text: string
  /** word list for the type scene */
  words: string[]
}

export type Show = {
  version: 1
  master: Master
  decks: [Deck, Deck]
  crossfade: number
  palette: Palette
  looks: (Look | null)[]
  outputs: Output[]
  fixtures: Fixture[]
  settings: Settings
}

export type Features = {
  bass: number
  mid: number
  high: number
  level: number
  flux: number
  onset: boolean
  /** 1 on an onset, decays each step */
  pulse: number
}

export type Clock = { bpm: number; anchor: number }
