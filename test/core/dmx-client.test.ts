import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDmxClient } from '../../src/link/dmx-client'

class FakeSocket {
  static made: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeSocket.made.push(this)
  }
  send(d: string) {
    if (this.readyState !== 1) throw new Error('not open')
    this.sent.push(d)
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
}

const frame = () => new Map([[0, new Uint8Array(512).fill(9)]])
let now = 0

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.made = []
  now = 0
})
afterEach(() => vi.useRealTimers())

describe('dmx client', () => {
  it('is offline until the socket opens, then online', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    expect(c.status()).toBe('offline')
    FakeSocket.made[0].open()
    expect(c.status()).toBe('online')
  })

  it('reconnects after 0.5, 1 and 2 s, doubling up to 8 s', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    FakeSocket.made[0].drop()
    expect(c.status()).toBe('offline')
    vi.advanceTimersByTime(499)
    expect(FakeSocket.made).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.made).toHaveLength(2)
    FakeSocket.made[1].drop()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.made).toHaveLength(3)
    FakeSocket.made[2].drop()
    vi.advanceTimersByTime(2000)
    expect(FakeSocket.made).toHaveLength(4)
    for (let i = 4; i < 8; i++) {
      FakeSocket.made[i - 1].drop()
      vi.advanceTimersByTime(8000)
    }
    FakeSocket.made.at(-1)!.drop()
    vi.advanceTimersByTime(7999)
    const n = FakeSocket.made.length
    vi.advanceTimersByTime(1)
    expect(FakeSocket.made.length).toBe(n + 1)
  })

  it('a successful connection resets the backoff', () => {
    createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    FakeSocket.made[0].drop()
    vi.advanceTimersByTime(500)
    FakeSocket.made[1].drop()
    vi.advanceTimersByTime(1000)
    FakeSocket.made[2].open()
    FakeSocket.made[2].drop()
    vi.advanceTimersByTime(500)
    expect(FakeSocket.made).toHaveLength(4)
  })

  it('sends at most 40 frames a second', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    FakeSocket.made[0].open()
    for (let i = 0; i < 100; i++) {
      now = i * 10
      c.send(frame())
    }
    expect(FakeSocket.made[0].sent.length).toBeLessThanOrEqual(40)
    expect(FakeSocket.made[0].sent.length).toBeGreaterThanOrEqual(38)
  })

  it('a frame is {u, d} with base64 data', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    FakeSocket.made[0].open()
    c.send(frame())
    const m = JSON.parse(FakeSocket.made[0].sent[0])
    expect(m.u).toBe(0)
    expect(Array.from(Buffer.from(m.d, 'base64'))).toEqual(new Array(512).fill(9))
  })

  it('drops frames while offline and never throws', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    expect(() => c.send(frame())).not.toThrow()
    expect(FakeSocket.made[0].sent).toHaveLength(0)
  })

  it('sendNow ignores the rate limit (panic)', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    FakeSocket.made[0].open()
    c.send(frame())
    c.sendNow(frame())
    expect(FakeSocket.made[0].sent).toHaveLength(2)
  })

  it('close stops reconnecting', () => {
    const c = createDmxClient('ws://x/dmx', { WebSocketImpl: FakeSocket as any, now: () => now })
    c.close()
    vi.advanceTimersByTime(20_000)
    expect(FakeSocket.made).toHaveLength(1)
  })
})
