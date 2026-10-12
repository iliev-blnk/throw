import { describe, expect, it } from 'vitest'
import { beats, createTapper, estimateTempo, nudge, phase, resync, setBpm } from '../../src/core/tempo'

const FPS = 60
/** onset-strength envelope: a short decaying pulse on every beat */
function envelope(bpm: number, seconds: number): Float32Array {
  const env = new Float32Array(seconds * FPS)
  for (let i = 0; i < env.length; i++) {
    const p = (i / FPS) % (60 / bpm)
    env[i] = Math.exp(-p * 40)
  }
  return env
}

describe('tap tempo', () => {
  it('taps every 0.5 s give 120 BPM', () => {
    const tap = createTapper()
    let bpm: number | null = null
    for (let i = 0; i < 4; i++) bpm = tap.tap(i * 0.5)
    expect(bpm).toBeCloseTo(120, 6)
  })

  it('a single tap gives no tempo', () => expect(createTapper().tap(3)).toBeNull())

  it('a gap over 2 s starts a new tempo', () => {
    const tap = createTapper()
    tap.tap(0)
    tap.tap(0.5)
    expect(tap.tap(3)).toBeNull()
    expect(tap.tap(3.4)).toBeCloseTo(150, 6)
  })

  it('four taps 0.469 s apart give 128 ± 0.5', () => {
    const tap = createTapper()
    let bpm: number | null = null
    for (let i = 0; i < 4; i++) bpm = tap.tap(10 + i * 0.469)
    expect(Math.abs(bpm! - 128)).toBeLessThan(0.5)
  })

  it('uses the median, so one late tap barely moves it', () => {
    const tap = createTapper()
    const times = [0, 0.5, 1, 1.5, 2.2, 2.5, 3]
    let bpm: number | null = null
    for (const t of times) bpm = tap.tap(t)
    expect(bpm).toBeCloseTo(120, 6)
  })
})

describe('auto tempo', () => {
  it('finds 128 BPM within 1', () =>
    expect(Math.abs(estimateTempo(envelope(128, 8), FPS)! - 128)).toBeLessThan(1))
  it('finds 120 BPM within 1', () =>
    expect(Math.abs(estimateTempo(envelope(120, 8), FPS)! - 120)).toBeLessThan(1))
  it('folds 70 BPM up to 140', () =>
    expect(Math.abs(estimateTempo(envelope(70, 8), FPS)! - 140)).toBeLessThan(1.5))
  it('returns null for a flat envelope', () => expect(estimateTempo(new Float32Array(480), FPS)).toBeNull())
})

describe('beat clock', () => {
  const c = { bpm: 120, anchor: 10 }
  it('phase and beat count', () => {
    expect(phase(c, 10)).toBeCloseTo(0)
    expect(phase(c, 10.25)).toBeCloseTo(0.5)
    expect(beats(c, 11.6)).toBe(3)
  })
  it('before the anchor the phase is still in [0, 1) and beats is 0', () => {
    expect(phase(c, 9.75)).toBeCloseTo(0.5)
    expect(beats(c, 5)).toBe(0)
  })
  it('resync makes this moment beat 1', () => {
    const r = resync(c, 13.37)
    expect(phase(r, 13.37)).toBe(0)
    expect(r.bpm).toBe(120)
  })
  it('setBpm keeps the phase continuous', () => {
    const t = 12.3
    const r = setBpm(c, t, 128)
    expect(Math.abs(phase(r, t) - phase(c, t))).toBeLessThan(1e-9)
    expect(r.bpm).toBe(128)
  })
  it('nudge moves the anchor toward a late onset by a tenth of the error', () => {
    const late = 10 + 4 * 0.5 + 0.05 // 0.1 beat late
    const r = nudge(c, late, late)
    expect(r.anchor - c.anchor).toBeCloseTo(0.005, 9)
  })
  it('nudge ignores an onset far from any beat', () => {
    const off = 10 + 4 * 0.5 + 0.25 // half a beat
    expect(nudge(c, off, off)).toEqual(c)
  })
})
