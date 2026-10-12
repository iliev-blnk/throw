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
