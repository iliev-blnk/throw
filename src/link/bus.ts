import type { Clock, Look, Show } from '../core/types'

/** What the operator sends every frame. Outputs extrapolate between messages. */
export type Live = {
  /** ms on the performance.timeOrigin clock that t counts from */
  epoch: number
  t: number
  clock: Clock
  bands: [number, number, number, number]
  pulse: number
  look: Look
  /** output id + surface ids in edit mode, else null */
  edit: { output: string; surfaces: string[] } | null
}

export type Msg =
  | { type: 'state'; show: Show }
  | ({ type: 'live' } & Live)
  | { type: 'hello'; role: 'operator' | 'output'; id?: string }
  | { type: 'heartbeat' }
  | { type: 'corner'; output: string; surface: string; index: number; x: number; y: number }
  | { type: 'media'; deck: 0 | 1; blob: Blob | null; kind: 'video' | 'image' }
  | { type: 'logo'; blob: Blob | null }

const TYPES = new Set(['state', 'live', 'hello', 'heartbeat', 'corner', 'media', 'logo'])

type ChannelLike = {
  onmessage: ((e: { data: unknown }) => void) | null
  postMessage(d: unknown): void
  close(): void
}

export function createBus(
  name = 'throw',
  Channel: new (name: string) => ChannelLike = BroadcastChannel as any,
): { send(msg: Msg): void; on(cb: (msg: Msg) => void): () => void; close(): void } {
  const ch = new Channel(name)
  const subs = new Set<(m: Msg) => void>()
  ch.onmessage = (e) => {
    const d = e.data as Msg
    if (!d || typeof d !== 'object' || !TYPES.has((d as any).type)) return
    for (const s of subs) s(d)
  }
  return {
    send: (msg) => ch.postMessage(msg),
    on(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    close: () => ch.close(),
  }
}
