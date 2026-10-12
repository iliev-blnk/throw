import { MAX_STROBE } from './show'

/** Is the strobe open at time t? Open for the first half of each period; 0 Hz means no strobe. */
export function strobeGate(hz: number, cap: number, t: number): boolean {
  const rate = Math.min(hz, cap, MAX_STROBE)
  if (!(rate > 0)) return true
  const p = t * rate
  return p - Math.floor(p) < 0.5
}
