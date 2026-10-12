import { createAnalyser, FRAME } from '../core/analyser'
import { estimateTempo } from '../core/tempo'
import type { Features } from '../core/types'

const RATE = 60 // analysis steps a second, same as the live analyser on requestAnimationFrame

export type FeatureTable = {
  fps: number
  frames: Features[]
  bpm: number | null
  /** features at time t, nearest video frame, clamped to the track */
  at(t: number): Features
}

/**
 * Run the live analyser over a whole track at 60 steps a second, then fold the steps into video
 * frames: an onset anywhere inside a frame counts for that frame, bands and pulse take the latest step.
 */
export function analyseBuffer(samples: Float32Array, sampleRate: number, fps: number): FeatureTable {
  const a = createAnalyser(sampleRate)
  const steps = Math.floor((samples.length / sampleRate) * RATE)
  const frame = new Float32Array(FRAME)
  const raw: Features[] = []
  const flux = new Float32Array(steps)
  for (let s = 0; s < steps; s++) {
    const end = Math.round(((s + 1) / RATE) * sampleRate)
    for (let i = 0; i < FRAME; i++) frame[i] = samples[end - FRAME + i] ?? 0
    const f = a.step(frame, s / RATE)
    raw.push(f)
    flux[s] = f.flux
  }
  const count = Math.floor((samples.length / sampleRate) * fps)
  const frames: Features[] = []
  for (let k = 0; k < count; k++) {
    const s0 = Math.floor((k / fps) * RATE)
    const s1 = Math.max(s0 + 1, Math.floor(((k + 1) / fps) * RATE))
    const span = raw.slice(s0, Math.min(s1, raw.length))
    const last = span.at(-1) ?? raw.at(-1)!
    frames.push({
      ...last,
      onset: span.some((f) => f.onset),
      pulse: Math.max(...span.map((f) => f.pulse), 0),
    })
  }
  return {
    fps,
    frames,
    bpm: estimateTempo(flux, RATE),
    at(t) {
      const i = Math.min(frames.length - 1, Math.max(0, Math.round(t * fps)))
      return frames[i]
    },
  }
}

/** Decode an audio file (URL or bytes) to mono samples. */
export async function decodeAudio(
  src: string | ArrayBuffer,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const bytes = typeof src === 'string' ? await (await fetch(src)).arrayBuffer() : src
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const buf = await ctx.decodeAudioData(bytes)
  const mono = new Float32Array(buf.length)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buf.numberOfChannels
  }
  return { samples: mono, sampleRate: buf.sampleRate }
}
