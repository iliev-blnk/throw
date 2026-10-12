import { buildUniverses, fixtureValues } from '../core/fixtures'
import { strobeGate } from '../core/strobe'
import type { Fixture } from '../core/types'
import type { Engine } from '../gl/engine'
import { createDmxClient, type DmxClient } from '../link/dmx-client'
import type { Runtime } from './runtime'
import type { Store } from './store'

export type ServerInfo = {
  version: string
  artnet: string
  nodes: { ip: string; shortName: string; longName: string }[]
}

/** Is the local throw server there? Null on the hosted (static) app. */
export async function health(): Promise<ServerInfo | null> {
  try {
    const r = await fetch('api/health', { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j?.artnet === 'string' ? j : null
  } catch {
    return null
  }
}

/** Computes DMX every frame from the program and the beat, and sends it when a server is there. */
export function createLights(store: Store, engine: Engine, rt: Runtime) {
  let client: DmxClient | null = null
  let info: ServerInfo | null = null
  let checked = false
  let universes = new Map<number, Uint8Array>()
  const values = new Map<string, Record<string, number>>()

  void (async () => {
    info = await health()
    checked = true
    if (!info) return
    const url = new URL('dmx', location.href)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    client = createDmxClient(url.href)
    setInterval(async () => {
      info = (await health()) ?? info
    }, 3000)
  })()

  const groups = (fs: Fixture[]) => {
    const g = new Map<string, Fixture[]>()
    for (const f of fs) g.set(f.group, [...(g.get(f.group) ?? []), f])
    return g
  }

  return {
    frame() {
      const show = store.get()
      if (!show.fixtures.length) {
        universes = new Map()
        values.clear()
        return
      }
      const { look, beat, t, features } = rt.state
      const inp = {
        pixel: (x: number, y: number) => engine.readPixel(x, y),
        palette: look.palette,
        beat,
        phase: beat - Math.floor(beat),
        level: features.level,
        dimmer: look.master.brightness,
        blackout: show.master.blackout,
        strobeOpen: strobeGate(show.master.strobe, show.settings.strobeCap, t),
      }
      universes = buildUniverses(show.fixtures, inp)
      const g = groups(show.fixtures)
      for (const f of show.fixtures) {
        const group = g.get(f.group)!
        values.set(f.id, fixtureValues(f, group.indexOf(f), group.length, inp))
      }
      client?.send(universes)
    },
    /** zeros on every patched universe, sent at once */
    panic() {
      const zero = new Map<number, Uint8Array>()
      for (const f of store.get().fixtures) zero.set(f.universe, new Uint8Array(512))
      universes = zero
      client?.sendNow(zero)
    },
    universes: () => universes,
    values: (id: string) => values.get(id),
    status: (): 'online' | 'offline' | 'none' | 'checking' =>
      !checked ? 'checking' : !info ? 'none' : (client?.status() ?? 'offline'),
    info: () => info,
    /** test hook: the last frame handed to the client */
    lastSent: () => universes,
  }
}

export type Lights = ReturnType<typeof createLights>
