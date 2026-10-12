import { describe, expect, it } from 'vitest'
import { createAnalyser, FRAME } from '../../src/core/analyser'
import { fft } from '../../src/core/fft'
import type { Features } from '../../src/core/types'

const SR = 48000
const FPS = 60

/** Feed `seconds` of a signal to the analyser at 60 steps a second, like requestAnimationFrame. */
function run(signal: (t: number) => number, seconds: number): Features[] {
  const a = createAnalyser(SR)
  const out: Features[] = []
  const frame = new Float32Array(FRAME)
  for (let step = 0; step < seconds * FPS; step++) {
    const end = Math.round(((step + 1) / FPS) * SR)
    for (let i = 0; i < FRAME; i++) frame[i] = signal((end - FRAME + i) / SR)
    out.push(a.step(frame, step / FPS))
  }
  return out
}

const sine = (hz: number) => (t: number) => 0.5 * Math.sin(2 * Math.PI * hz * t)
/** 120 BPM: a 30 ms decaying 80 Hz thump every 0.5 s */
const clicks = (bpm: number) => (t: number) => {
  const p = t % (60 / bpm)
  return p < 0.03 ? Math.sin(2 * Math.PI * 80 * p) * (1 - p / 0.03) : 0
}

describe('fft', () => {
  it('puts a bin-centred sine into one bin', () => {
    const n = 64
    const re = new Float32Array(n)
    const im = new Float32Array(n)
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n)
    fft(re, im)
    const mag = Array.from(re, (r, i) => Math.hypot(r, im[i]))
    expect(mag[5]).toBeCloseTo(32, 3)
    expect(mag[7]).toBeLessThan(1e-3)
  })
})

describe('analyser', () => {
  it('a 60 Hz sine is bass', () => {
    const f = run(sine(60), 2).at(-1)!
    expect(f.bass).toBeGreaterThan(0.8)
    expect(f.bass).toBeGreaterThan(3 * f.high)
  })

  it('a 5 kHz sine is high', () => {
    const f = run(sine(5000), 2).at(-1)!
    expect(f.high).toBeGreaterThan(0.8)
    expect(f.high).toBeGreaterThan(3 * f.bass)
  })

  it('silence gives finite zeros and no onsets', () => {
    const fs = run(() => 0, 2)
    for (const f of fs) {
      for (const v of [f.bass, f.mid, f.high, f.level, f.flux, f.pulse]) expect(v).toBe(0)
      expect(f.onset).toBe(false)
    }
  })

  it('finds an onset on every beat of a 120 BPM click train', () => {
    const fs = run(clicks(120), 8)
    const onsets = fs.flatMap((f, i) => (f.onset ? [i / FPS] : []))
    const expected = Array.from({ length: 14 }, (_, k) => 1 + k * 0.5)
    for (const t of expected) expect(onsets.some((o) => Math.abs(o - t) <= 1.5 / FPS)).toBe(true)
    expect(onsets.filter((o) => o >= 1).length).toBeLessThanOrEqual(15)
  })

  it('puts the onsets on the kicks, not on louder off-beat hats', () => {
    // seeded noise, high-passed by a first difference like a drum machine hat
    let seed = 1
    const white = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 2 ** 31 - 1
    }
    const hatAt = new Map<number, number>()
    const beat = 0.5
    const kick = clicks(120)
    const signal = (t: number) => {
      const p = (t + beat / 2) % beat // hats half a beat after each kick
      const i = Math.round(t * SR)
      if (!hatAt.has(i)) hatAt.set(i, white())
      const hp = hatAt.get(i)! - (hatAt.get(i - 1) ?? 0)
      const hat = p < 0.04 ? hp * 0.8 * (1 - p / 0.04) : 0
      return kick(t) * 0.6 + hat
    }
    const fs = run(signal, 8)
    const onsets = fs.flatMap((f, i) => (f.onset && i / FPS >= 2 ? [i] : []))
    const isKick = (i: number) => Math.abs(i / FPS / beat - Math.round(i / FPS / beat)) * beat <= 1.5 / FPS
    const kicks = onsets.filter(isKick)
    const hats = onsets.filter((i) => !isKick(i))
    expect(kicks.length).toBeGreaterThanOrEqual(11)
    // a hat in a sparse signal is an onset too, but well below a kick
    const mean = (xs: number[]) => xs.reduce((a, i) => a + fs[i].flux, 0) / Math.max(1, xs.length)
    expect(mean(kicks)).toBeGreaterThan(2 * mean(hats))
  })

  it('never reports two onsets closer than 100 ms', () => {
    const noise = (t: number) => Math.sin(t * 1e4 * Math.sin(t * 13)) * (Math.sin(t * 40) > 0.6 ? 1 : 0.05)
    const fs = run(noise, 6)
    const onsets = fs.flatMap((f, i) => (f.onset ? [i / FPS] : []))
    for (let i = 1; i < onsets.length; i++)
      expect(onsets[i] - onsets[i - 1]).toBeGreaterThanOrEqual(0.1 - 1e-9)
  })

  it('pulse is 1 on an onset and decays after', () => {
    const fs = run(clicks(120), 3)
    const i = fs.findIndex((f, k) => k > 60 && f.onset)
    expect(fs[i].pulse).toBe(1)
    expect(fs[i + 1].pulse).toBeCloseTo(0.9)
  })
})
