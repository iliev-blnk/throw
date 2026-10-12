import { createAnalyser, FRAME } from '../core/analyser'
import type { Features } from '../core/types'

export type LiveAudio = {
  /** analyse the latest audio; call once per animation frame */
  features(t: number): Features
  stop(): void
  status: string
  source: 'mic' | 'file' | 'none'
}

const SILENT: Features = { bass: 0, mid: 0, high: 0, level: 0, flux: 0, onset: false, pulse: 0 }

export function silentAudio(status: string): LiveAudio {
  return { features: () => SILENT, stop() {}, status, source: 'none' }
}

export async function listInputs(): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
  } catch {
    return []
  }
}

/**
 * Microphone / line-in (no echo cancellation, noise suppression or auto gain: they mangle music),
 * or a local audio file played through the speakers. Never throws: a blocked mic gives a silent
 * source whose status says why.
 */
export async function startLive(opts: { deviceId?: string; file?: File } = {}): Promise<LiveAudio> {
  let ctx: AudioContext | null = null
  try {
    ctx = new AudioContext()
    const analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = FRAME
    let stopSource: () => void
    let status: string
    let source: 'mic' | 'file'
    if (opts.file) {
      const el = new Audio(URL.createObjectURL(opts.file))
      el.loop = true
      const node = ctx.createMediaElementSource(el)
      node.connect(analyserNode)
      node.connect(ctx.destination)
      await el.play()
      stopSource = () => {
        el.pause()
        URL.revokeObjectURL(el.src)
      }
      status = `playing ${opts.file.name}`
      source = 'file'
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: opts.deviceId ? { exact: opts.deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      ctx.createMediaStreamSource(stream).connect(analyserNode)
      stopSource = () => {
        for (const tr of stream.getTracks()) tr.stop()
      }
      status = `listening: ${stream.getAudioTracks()[0]?.label || 'microphone'}`
      source = 'mic'
    }
    if (ctx.state === 'suspended') await ctx.resume()
    const analyser = createAnalyser(ctx.sampleRate)
    const buf = new Float32Array(FRAME)
    const c = ctx
    return {
      features(t) {
        analyserNode.getFloatTimeDomainData(buf)
        return analyser.step(buf, t)
      },
      stop() {
        stopSource()
        void c.close()
      },
      status,
      source,
    }
  } catch (e) {
    void ctx?.close()
    const reason = e instanceof Error ? e.message || e.name : String(e)
    return silentAudio(opts.file ? `could not play the file: ${reason}` : `microphone blocked: ${reason}`)
  }
}
