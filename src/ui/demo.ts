// The demo show used by previs.html?demo, the README video and the showcase: four surfaces
// (wall + three boxes), four moving heads, four floor pars and a set of looks for autopilot.
import { defaultOutput, defaultShow } from '../core/show'
import type { Fixture, Look, Show } from '../core/types'
import { defaultParams } from '../scenes/index'

const look = (
  a: string,
  b: string,
  crossfade: number,
  palette: Look['palette'],
  pa?: number[],
  pb?: number[],
): Look => ({
  decks: [
    { scene: a, params: pa ?? defaultParams(a) },
    { scene: b, params: pb ?? defaultParams(b) },
  ],
  crossfade,
  palette,
  master: { brightness: 1, hue: 0 },
})

const AMBER: Look['palette'] = [
  [1, 0.55, 0.12],
  [0.16, 0.22, 0.95],
  [1, 0.97, 0.9],
]
const ICE: Look['palette'] = [
  [0.35, 0.75, 1],
  [0.05, 0.08, 0.5],
  [0.95, 0.98, 1],
]
const RED: Look['palette'] = [
  [1, 0.12, 0.08],
  [0.35, 0, 0.12],
  [1, 0.85, 0.75],
]
const ACID: Look['palette'] = [
  [0.75, 1, 0.1],
  [0.05, 0.35, 0.3],
  [1, 1, 1],
]

export function demoShow(): Show {
  const s = defaultShow()
  const out = defaultOutput('o1', 'Wall + boxes')
  const corners = out.surfaces[0].corners
  out.surfaces = [
    { ...out.surfaces[0], id: 'wall', slice: { x: 0, y: 0, w: 1, h: 1 } },
    { ...out.surfaces[0], id: 'box1', slice: { x: 0, y: 0.25, w: 0.33, h: 0.5 }, corners },
    { ...out.surfaces[0], id: 'box2', slice: { x: 0.33, y: 0.2, w: 0.34, h: 0.6 }, corners },
    { ...out.surfaces[0], id: 'box3', slice: { x: 0.67, y: 0.25, w: 0.33, h: 0.5 }, corners },
  ]
  s.outputs = [out]
  const mover = (i: number): Fixture => ({
    id: `m${i + 1}`,
    name: `mover ${i + 1}`,
    profile: 'mover',
    universe: 0,
    address: 1 + i * 9,
    x: 0.1 + i * 0.267,
    y: 0.1,
    group: 'movers',
    mode: 'pixel',
    color: [1, 1, 1],
    pattern: { kind: i % 2 ? 'figure8' : 'circle', size: 0.4, centre: [0.5, 0.62], speed: 0.5 },
  })
  const par = (i: number): Fixture => ({
    id: `p${i + 1}`,
    name: `par ${i + 1}`,
    profile: 'rgb',
    universe: 0,
    address: 37 + i * 3,
    x: 0.08 + i * 0.28,
    y: 0.92,
    group: 'pars',
    mode: 'pixel',
    color: [1, 1, 1],
  })
  s.fixtures = [0, 1, 2, 3].map(mover).concat([0, 1, 2, 3].map(par))
  s.settings.text = 'throw'
  s.settings.words = ['THROW', 'LIGHT', 'ROOM', 'NIGHT', 'SOUND', 'WALL']
  s.settings.transitionBeats = 4
  s.settings.autopilot = { on: true, bars: 4, random: false }
  s.looks = [
    look('raze', 'scan', 0, AMBER),
    look('raze', 'scan', 1, ICE),
    look('hilbert', 'grid', 0, ACID),
    look('smoke', 'type', 1, RED),
    look('smoke', 'scan', 0, ICE),
    look('grid', 'type', 1, AMBER),
    ...Array(10).fill(null),
  ]
  const first = s.looks[0]!
  s.decks = structuredClone(first.decks)
  s.crossfade = first.crossfade
  s.palette = structuredClone(first.palette)
  return s
}

/** Fake audio from the beat: a kick on every beat, hats on the off-beats. */
export function syntheticBands(beat: number): { bands: [number, number, number, number]; pulse: number } {
  const ph = beat - Math.floor(beat)
  const kick = Math.exp(-ph * 7)
  const hat = Math.exp(-Math.abs(ph - 0.5) * 18)
  return { bands: [kick, 0.35 + 0.25 * Math.sin(beat * 0.7), 0.3 + 0.6 * hat, 0.4 + 0.5 * kick], pulse: kick }
}
