// The demo track: 124 BPM, 16 bars (≈31 s), synthesised with pagereel/audio so the video has no
// copyright issues. Deterministic: the same file every run.
//   node demo/synth.mjs [out.wav]
import { fileURLToPath } from 'node:url'
import { createMix, note } from 'pagereel/audio'

export const BPM = 124
export const BARS = 16
const B = (beats) => (beats * 60) / BPM

export function writeDemo(path) {
  const mix = createMix(B(BARS * 4))
  // i – VI – III – VII in A minor, one chord a bar
  const chords = [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ]
  const roots = [33, 29, 36, 31]
  const bell = [76, 72, 67, 74]

  for (let bar = 0; bar < BARS; bar++) {
    const i = bar % 4
    const at = (beat) => B(bar * 4 + beat)
    const part = Math.floor(bar / 4) // 0 intro, 1 groove, 2 clap + 16ths, 3 full
    mix.pad(at(0), B(4), chords[i].map(note), { gain: part === 0 ? 0.9 : 0.6 })
    for (let k = 0; k < 4; k++) {
      mix.hat(at(k + 0.5), { pan: 0.3, gain: 0.8 })
      if (part >= 2) {
        mix.hat(at(k + 0.25), { pan: -0.3, gain: 0.3 })
        mix.hat(at(k + 0.75), { pan: -0.3, gain: 0.3 })
      }
      if (part >= 1) {
        mix.kick(at(k))
        mix.bass(at(k), B(0.45), note(roots[i]))
      }
    }
    if (part === 0) mix.sub(at(0), { gain: 0.6 })
    if (part >= 2) {
      mix.snare(at(1))
      mix.snare(at(3))
    }
    if (part >= 1) mix.bass(at(3.5), B(0.4), note(roots[i] + 12), { gain: 0.2 })
    if (part === 3) mix.bell(at(0), note(bell[i]), { gain: 0.35, pan: 0.2 })
  }
  mix.whoosh(B(4 * 4 - 2), B(2), { gain: 0.4 })
  mix.whoosh(B(12 * 4 - 2), B(2), { gain: 0.5 })
  mix.crash(B(12 * 4), { gain: 0.5 })
  mix.write(path)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeDemo(process.argv[2] ?? 'demo/demo.wav')
