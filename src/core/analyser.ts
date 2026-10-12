import { fft } from './fft'
import type { Features } from './types'

export const FRAME = 2048
export const BANDS = { bass: [20, 150], mid: [150, 2000], high: [2000, 12000] } as const

const PEAK_DECAY = 0.995 // per step: auto gain recovers in a few seconds after a loud part
const CROSS_FLOOR = 0.1 // a band's gain never exceeds 10× the loudest band's, so leakage stays small
const GATE = 1e-4 // RMS below this (−80 dBFS) counts as silence
const HISTORY = 60 // ~1 s of flux at 60 steps a second
const ONSET_K = 1.5
const MIN_GAP = 0.1 // s
const PULSE_DECAY = 0.9

export type Analyser = { step(frame: Float32Array, t: number): Features }

export function createAnalyser(sampleRate: number): Analyser {
  const window = Float32Array.from(
    { length: FRAME },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)),
  )
  const re = new Float32Array(FRAME)
  const im = new Float32Array(FRAME)
  const half = FRAME / 2
  const prev = new Float32Array(half)
  const bin = (hz: number) => Math.min(half - 1, Math.max(1, Math.round((hz * FRAME) / sampleRate)))
  const ranges = [BANDS.bass, BANDS.mid, BANDS.high].map(([lo, hi]) => [bin(lo), bin(hi)])
  const peaks = [0, 0, 0]
  let levelPeak = 0
  const flux: number[] = []
  let lastOnset = Number.NEGATIVE_INFINITY
  let pulse = 0

  return {
    step(frame, t) {
      let sum = 0
      for (let i = 0; i < FRAME; i++) {
        const v = frame[i] ?? 0
        sum += v * v
        re[i] = v * window[i]
        im[i] = 0
      }
      const rms = Math.sqrt(sum / FRAME)
      fft(re, im)

      let fl = 0
      for (let k = 0; k < half; k++) {
        // linear magnitude: a log scale lets the broadband smear of a sound stopping dead outweigh the attack
        const m = Math.hypot(re[k], im[k])
        const d = m - prev[k]
        if (d > 0) fl += d
        prev[k] = m
      }

      const raw = ranges.map(([a, b]) => {
        let p = 0
        for (let k = a; k <= b; k++) p += re[k] * re[k] + im[k] * im[k]
        return Math.sqrt(p / (b - a + 1))
      })
      const loudest = Math.max(...raw)
      for (let i = 0; i < 3; i++) peaks[i] = Math.max(peaks[i] * PEAK_DECAY, raw[i])
      const top = Math.max(...peaks)
      const bands = raw.map((v, i) => (v > 0 ? Math.min(1, v / Math.max(peaks[i], CROSS_FLOOR * top)) : 0))
      levelPeak = Math.max(levelPeak * PEAK_DECAY, rms)
      const level = rms > 0 ? Math.min(1, rms / levelPeak) : 0

      const silent = rms < GATE || loudest === 0
      if (silent) fl = 0
      let onset = false
      if (flux.length >= 8 && fl > 0) {
        const mean = flux.reduce((a, b) => a + b, 0) / flux.length
        const sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length)
        onset = fl > mean + ONSET_K * sd && t - lastOnset >= MIN_GAP - 1e-9
      }
      flux.push(fl)
      if (flux.length > HISTORY) flux.shift()
      if (onset) lastOnset = t
      pulse = onset ? 1 : pulse * PULSE_DECAY
      if (pulse < 1e-4) pulse = 0

      return {
        bass: silent ? 0 : bands[0],
        mid: silent ? 0 : bands[1],
        high: silent ? 0 : bands[2],
        level: silent ? 0 : level,
        flux: fl,
        onset,
        pulse,
      }
    },
  }
}
