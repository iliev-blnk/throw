// WebSocket client for the server's /dmx bridge: reconnects with backoff, sends at most 40 Hz,
// drops frames while offline and never throws into the render loop.

const BACKOFF = [500, 1000, 2000, 4000, 8000]
const MIN_GAP = 25 // ms → 40 frames a second

type SocketLike = {
  readyState: number
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send(d: string): void
  close(): void
}

export type DmxClient = {
  send(universes: Map<number, Uint8Array>): void
  /** send now, ignoring the rate limit (panic) */
  sendNow(universes: Map<number, Uint8Array>): void
  status(): 'online' | 'offline'
  close(): void
}

function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function createDmxClient(
  url: string,
  opts: { WebSocketImpl?: new (url: string) => SocketLike; now?: () => number } = {},
): DmxClient {
  const Impl = opts.WebSocketImpl ?? (WebSocket as unknown as new (url: string) => SocketLike)
  const now = opts.now ?? (() => performance.now())
  let sock: SocketLike | null = null
  let attempt = 0
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let next = Number.NEGATIVE_INFINITY // earliest time the next frame may go

  const connect = () => {
    if (closed) return
    try {
      sock = new Impl(url)
    } catch {
      retry()
      return
    }
    sock.onopen = () => {
      attempt = 0
    }
    sock.onclose = () => {
      sock = null
      retry()
    }
    sock.onerror = () => undefined
  }
  const retry = () => {
    if (closed) return
    clearTimeout(timer)
    timer = setTimeout(connect, BACKOFF[Math.min(attempt, BACKOFF.length - 1)])
    attempt++
  }
  const write = (universes: Map<number, Uint8Array>) => {
    if (sock?.readyState !== 1) return
    try {
      for (const [u, d] of universes) sock.send(JSON.stringify({ u, d: b64(d) }))
    } catch {
      // the socket died between the check and the send; onclose reconnects
    }
  }
  connect()

  return {
    send(universes) {
      const t = now()
      if (t < next) return
      // advance from the schedule, not from t, so 60 fps frames average out to 40 Hz
      // (after a pause, restart the schedule from t instead of bursting to catch up)
      next = (t - next > MIN_GAP ? t : next) + MIN_GAP
      write(universes)
    },
    sendNow(universes) {
      next = now() + MIN_GAP
      write(universes)
    },
    status: () => (sock && sock.readyState === 1 ? 'online' : 'offline'),
    close() {
      closed = true
      clearTimeout(timer)
      sock?.close()
    },
  }
}
