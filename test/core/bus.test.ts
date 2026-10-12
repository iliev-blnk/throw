import { describe, expect, it } from 'vitest'
import { defaultShow } from '../../src/core/show'
import { createBus, type Msg } from '../../src/link/bus'

/** In-memory stand-in for BroadcastChannel: delivers to every other instance with the same name. */
class FakeChannel {
  static all: FakeChannel[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  constructor(public name: string) {
    FakeChannel.all.push(this)
  }
  postMessage(data: unknown) {
    for (const c of FakeChannel.all)
      if (c !== this && c.name === this.name) c.onmessage?.({ data: structuredClone(data) })
  }
  close() {
    FakeChannel.all = FakeChannel.all.filter((c) => c !== this)
  }
}

describe('bus', () => {
  it('delivers a message to the other side and not to itself', () => {
    const a = createBus('t1', FakeChannel as any)
    const b = createBus('t1', FakeChannel as any)
    const gotA: Msg[] = []
    const gotB: Msg[] = []
    a.on((m) => gotA.push(m))
    b.on((m) => gotB.push(m))
    const msg: Msg = { type: 'state', show: defaultShow() }
    a.send(msg)
    expect(gotB).toEqual([msg])
    expect(gotA).toEqual([])
  })

  it('ignores messages that are not bus messages', () => {
    const a = createBus('t2', FakeChannel as any)
    const got: Msg[] = []
    a.on((m) => got.push(m))
    new FakeChannel('t2').postMessage({ hello: 1 })
    new FakeChannel('t2').postMessage('junk')
    expect(got).toEqual([])
  })

  it('unsubscribes', () => {
    const a = createBus('t3', FakeChannel as any)
    const b = createBus('t3', FakeChannel as any)
    let n = 0
    const off = b.on(() => n++)
    off()
    a.send({ type: 'heartbeat' })
    expect(n).toBe(0)
  })
})
