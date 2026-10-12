import { describe, expect, it } from 'vitest'
import {
  buildUniverses,
  fixtureValues,
  type LightInput,
  moverPanTilt,
  validatePatch,
} from '../../src/core/fixtures'
import type { Fixture, PatternKind } from '../../src/core/types'

const fx = (p: Partial<Fixture>): Fixture => ({
  id: 'f',
  name: 'f',
  profile: 'rgb',
  universe: 0,
  address: 1,
  x: 0.5,
  y: 0.5,
  group: 'g',
  mode: 'static',
  color: [1, 0.5, 0],
  ...p,
})
const input = (p: Partial<LightInput> = {}): LightInput => ({
  pixel: () => [0, 1, 0],
  palette: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  beat: 0,
  phase: 0,
  level: 1,
  dimmer: 1,
  blackout: false,
  strobeOpen: true,
  ...p,
})

describe('fixtures', () => {
  it('an rgb par at address 10 writes channels 10–12 (0-based 9–11)', () => {
    const u = buildUniverses([fx({ address: 10 })], input()).get(0)!
    expect([u[8], u[9], u[10], u[11], u[12]]).toEqual([0, 255, 128, 0, 0])
  })

  it('pixel mode takes the colour under the fixture', () => {
    expect(fixtureValues(fx({ mode: 'pixel' }), 0, 1, input())).toMatchObject({ r: 0, g: 255, b: 0 })
  })

  it('rgbw pulls the common white out', () => {
    const v = fixtureValues(fx({ profile: 'rgbw', color: [1, 1, 0.5] }), 0, 1, input())
    expect(v).toEqual({ r: 128, g: 128, b: 0, w: 128 })
  })

  it('blackout zeros intensity and colour of every profile but leaves movers where they point', () => {
    const fs: Fixture[] = [
      fx({ address: 1 }),
      fx({ address: 4, profile: 'rgbw' }),
      fx({ address: 8, profile: 'dimmer' }),
      fx({
        address: 9,
        profile: 'mover',
        pattern: { kind: 'circle', size: 0.5, centre: [0.5, 0.5], speed: 1 },
      }),
    ]
    const u = buildUniverses(fs, input({ blackout: true })).get(0)!
    const mover = 8 // 0-based start of the mover at address 9: pan, panFine, tilt, tiltFine, dimmer, r, g, b, strobe
    const intensity = [...u.slice(0, mover), ...u.slice(mover + 4)]
    expect(intensity.every((v) => v === 0)).toBe(true)
    expect(u[mover]).toBeGreaterThan(0)
  })

  it('a closed strobe gate zeros intensity', () => {
    expect(fixtureValues(fx({}), 0, 1, input({ strobeOpen: false }))).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('beat mode lights one fixture of the group per beat', () => {
    const lit = (beat: number) =>
      [0, 1, 2, 3].map((i) => {
        const v = fixtureValues(fx({ mode: 'beat' }), i, 4, input({ beat }))
        return v.r + v.g + v.b > 0
      })
    expect(lit(0)).toEqual([true, false, false, false])
    expect(lit(5)).toEqual([false, true, false, false])
  })

  it('a mover writes 16-bit pan and tilt and its dimmer', () => {
    const f = fx({ profile: 'mover', pattern: { kind: 'circle', size: 0, centre: [0.5, 0.25], speed: 1 } })
    const v = fixtureValues(f, 0, 1, input())
    expect(v.pan * 256 + v.panFine).toBe(Math.round(0.5 * 65535))
    expect(v.tilt * 256 + v.tiltFine).toBe(Math.round(0.25 * 65535))
    expect(v.dimmer).toBe(255)
    expect([v.r, v.g, v.b]).toEqual([255, 128, 0])
  })

  it('mover pan/tilt stay in [0, 1] for every pattern', () => {
    for (const kind of ['circle', 'figure8', 'sweep', 'fan'] as PatternKind[]) {
      for (let b = 0; b < 1000; b += 0.37) {
        for (let i = 0; i < 4; i++) {
          const { pan, tilt } = moverPanTilt({ kind, size: 1, centre: [0.9, 0.1], speed: 2 }, b, i, 4)
          expect(pan).toBeGreaterThanOrEqual(0)
          expect(pan).toBeLessThanOrEqual(1)
          expect(tilt).toBeGreaterThanOrEqual(0)
          expect(tilt).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('fan spreads four movers to four different pans', () => {
    const pans = [0, 1, 2, 3].map(
      (i) => moverPanTilt({ kind: 'fan', size: 0.6, centre: [0.5, 0.5], speed: 1 }, 1, i, 4).pan,
    )
    expect(new Set(pans.map((p) => p.toFixed(4))).size).toBe(4)
  })
})

describe('validatePatch', () => {
  it('accepts a clean patch', () => {
    expect(validatePatch([fx({ address: 1 }), fx({ id: 'b', address: 4 })])).toEqual([])
  })
  it('flags a fixture running past channel 512', () => {
    expect(validatePatch([fx({ name: 'wash', profile: 'rgbw', address: 511 })])).toEqual([
      'wash: channels 511–514 run past 512',
    ])
  })
  it('flags overlapping fixtures in the same universe only', () => {
    expect(validatePatch([fx({ name: 'a', address: 1 }), fx({ name: 'b', address: 3 })])).toEqual([
      'b overlaps a at channel 3',
    ])
    expect(
      validatePatch([fx({ name: 'a', address: 1 }), fx({ name: 'b', address: 3, universe: 1 })]),
    ).toEqual([])
  })
})
