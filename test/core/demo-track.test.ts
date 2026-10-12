import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyseBuffer } from '../../src/audio/offline'

/** 16-bit PCM WAV (as pagereel/audio writes it) → mono samples */
function readWav(path: string): { samples: Float32Array; sampleRate: number } {
  const b = readFileSync(path)
  const channels = b.readUInt16LE(22)
  const sampleRate = b.readUInt32LE(24)
  const data = b.indexOf('data') + 8
  const n = (b.length - data) / (2 * channels)
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < channels; c++) s += b.readInt16LE(data + (i * channels + c) * 2)
    samples[i] = s / channels / 32768
  }
  return { samples, sampleRate }
}

describe('the demo track through the analyser', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'throw-')), 'demo.wav')
  execFileSync('node', ['demo/synth.mjs', path])
  const { samples, sampleRate } = readWav(path)
  const table = analyseBuffer(samples, sampleRate, 30)

  it('finds 124 BPM in a full mix', () => {
    expect(Math.abs(table.bpm! - 124)).toBeLessThan(1.5)
  })

  it('puts the onsets of the kick section on the beat', () => {
    const beat = 60 / 124
    const onsets = table.frames.flatMap((f, k) => (f.onset && k / 30 >= 8 && k / 30 < 20 ? [k / 30] : []))
    const onBeat = onsets.filter((t) => Math.abs(t / beat - Math.round(t / beat)) * beat <= 1.5 / 30)
    expect(onBeat.length).toBeGreaterThan(0.85 * Math.round(12 / beat))
    expect(onBeat.length / onsets.length).toBeGreaterThan(0.8)
  })
})
