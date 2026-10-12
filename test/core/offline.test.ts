import { describe, expect, it } from 'vitest'
import { analyseBuffer } from '../../src/audio/offline'

const SR = 44100
function kicks(bpm: number, seconds: number): Float32Array {
  const out = new Float32Array(SR * seconds)
  const period = 60 / bpm
  for (let i = 0; i < out.length; i++) {
    const p = (i / SR) % period
    out[i] = p < 0.12 ? Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-p * 30)) * p) * Math.exp(-p * 18) : 0
  }
  return out
}

describe('offline analysis', () => {
  const table = analyseBuffer(kicks(124, 10), SR, 30)

  it('has one frame per video frame', () => expect(table.frames.length).toBe(300))

  it('finds an onset on every kick after the first second', () => {
    const onsets = table.frames.flatMap((f, i) => (f.onset ? [i / 30] : []))
    for (let k = 3; k < 20; k++) {
      const t = k * (60 / 124)
      expect(onsets.some((o) => Math.abs(o - t) <= 1 / 30 + 1e-9)).toBe(true)
    }
  })

  it('does not fire a second onset on the kick tail', () => {
    const onsets = table.frames.flatMap((f, i) => (f.onset && i / 30 > 1 ? [i / 30] : []))
    for (const o of onsets) {
      const k = Math.round(o / (60 / 124))
      expect(Math.abs(o - k * (60 / 124))).toBeLessThanOrEqual(1 / 30 + 1e-9)
    }
  })

  it('estimates the tempo', () => expect(Math.abs(table.bpm! - 124)).toBeLessThan(1.5))

  it('clamps at() outside the track', () => {
    expect(table.at(-1)).toEqual(table.frames[0])
    expect(table.at(1e9)).toEqual(table.frames.at(-1))
  })
})
