import type { Features } from '../core/types'
import { analyseBuffer, decodeAudio, type FeatureTable } from './offline'

/** A track for render mode: decoded and analysed once, then read per video frame. */
export type Track = { url: string; duration: number; table: FeatureTable }

export async function loadTrack(url: string, fps: number): Promise<Track> {
  const { samples, sampleRate } = await decodeAudio(url)
  return {
    url: new URL(url, location.href).href,
    duration: samples.length / sampleRate,
    table: analyseBuffer(samples, sampleRate, fps),
  }
}

/** The engine's audio inputs from the analysed track at time t. */
export function trackInput(f: Features): { bands: [number, number, number, number]; pulse: number } {
  return { bands: [f.bass, f.mid, f.high, f.level], pulse: f.pulse }
}
