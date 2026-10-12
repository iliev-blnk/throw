import type { Clock } from './types'

const TAP_RESET = 2 // s
const TAP_KEEP = 8 // intervals
const MIN_BPM = 80
const MAX_BPM = 170
const PLL_GAIN = 0.1
const PLL_WINDOW = 0.15 // beats

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function createTapper(): { tap(t: number): number | null } {
  let last: number | null = null
  let intervals: number[] = []
  return {
    tap(t) {
      if (last !== null && t - last > TAP_RESET) intervals = []
      else if (last !== null) intervals.push(t - last)
      last = t
      if (intervals.length > TAP_KEEP) intervals.shift()
      return intervals.length ? 60 / median(intervals) : null
    },
  }
}

/** Fold a tempo into 80–170, preferring 100–150 when doubling stays in range. */
export function fold(bpm: number): number {
  while (bpm < MIN_BPM) bpm *= 2
  while (bpm > MAX_BPM) bpm /= 2
  if (bpm < 100 && bpm * 2 <= MAX_BPM) bpm *= 2
  return bpm
}

/**
 * Tempo from an onset-strength envelope sampled at `fps`, by autocorrelation.
 * Searches 40–220 BPM, refines the peak by parabolic interpolation, then folds.
 */
export function estimateTempo(env: Float32Array, fps: number): number | null {
  const n = env.length
  let mean = 0
  for (const v of env) mean += v
  mean /= n
  const x = Float32Array.from(env, (v) => v - mean)
  let energy = 0
  for (const v of x) energy += v * v
  if (energy < 1e-9) return null

  const lo = Math.max(2, Math.floor((fps * 60) / 220))
  const hi = Math.min(n - 2, Math.ceil((fps * 60) / 40))
  const ac = new Float64Array(hi + 2)
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag]
    ac[lag] = s / (n - lag) // unbiased, so long lags are not penalised
  }
  let best = -1
  for (let lag = lo; lag <= hi; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && (best < 0 || ac[lag] > ac[best] * 1.0001))
      best = lag
    // a local peak that is not clearly higher than an earlier one loses: the shortest period wins ties
  }
  if (best < 0 || ac[best] <= 0) return null
  const a = ac[best - 1]
  const b = ac[best]
  const c = ac[best + 1]
  const den = a - 2 * b + c
  const lag = den !== 0 ? best + (0.5 * (a - c)) / den : best
  return fold((fps * 60) / lag)
}

const beatsF = (c: Clock, t: number) => ((t - c.anchor) * c.bpm) / 60

export function phase(c: Clock, t: number): number {
  const b = beatsF(c, t)
  return b - Math.floor(b)
}

export function beats(c: Clock, t: number): number {
  return Math.max(0, Math.floor(beatsF(c, t) + 1e-9))
}

export function resync(c: Clock, t: number): Clock {
  return { bpm: c.bpm, anchor: t }
}

export function setBpm(c: Clock, t: number, bpm: number): Clock {
  return { bpm, anchor: t - (beatsF(c, t) * 60) / bpm }
}

/** Phase-locked loop: an onset close to a predicted beat pulls the anchor a little toward it. */
export function nudge(c: Clock, _t: number, onsetT: number): Clock {
  const b = beatsF(c, onsetT)
  const err = b - Math.round(b)
  if (Math.abs(err) > PLL_WINDOW) return c
  return { bpm: c.bpm, anchor: c.anchor + (err * PLL_GAIN * 60) / c.bpm }
}
