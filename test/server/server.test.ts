import { createSocket, type Socket } from 'node:dgram'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { startServer } from '../../server/server.js'
import { parseArtDmx } from '../../src/core/artnet.js'

let udp: Socket
let server: Awaited<ReturnType<typeof startServer>>
const packets: Buffer[] = []
let waiters: (() => void)[] = []

beforeAll(async () => {
  udp = createSocket('udp4')
  udp.on('message', (m) => {
    packets.push(m)
    for (const w of waiters) w()
    waiters = []
  })
  await new Promise<void>((ok) => udp.bind(0, '127.0.0.1', ok))
  const root = mkdtempSync(join(tmpdir(), 'throw-'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>throw</title>')
  writeFileSync(join(root, 'app.js'), 'console.log(1)')
  server = await startServer({
    port: 0,
    host: '127.0.0.1',
    artnet: `127.0.0.1:${udp.address().port}`,
    root,
    discover: false,
  })
})
afterAll(async () => {
  await server?.close()
  udp?.close()
})

const nextPacket = () => new Promise<void>((ok) => waiters.push(ok))

describe('server', () => {
  it('turns a WebSocket DMX frame into an ArtDMX packet', async () => {
    const ws = new WebSocket(`${server.url.replace('http', 'ws')}dmx`)
    await new Promise((ok) => ws.on('open', ok))
    const data = new Uint8Array(512).map((_, i) => (i * 7) & 255)
    const got = nextPacket()
    ws.send(JSON.stringify({ u: 3, d: Buffer.from(data).toString('base64') }))
    await got
    const p = parseArtDmx(new Uint8Array(packets.at(-1)!))!
    expect(p.universe).toBe(3)
    expect(Array.from(p.data)).toEqual(Array.from(data))
    const seq = p.seq
    const again = nextPacket()
    ws.send(JSON.stringify({ u: 3, d: Buffer.from(data).toString('base64') }))
    await again
    expect(parseArtDmx(new Uint8Array(packets.at(-1)!))!.seq).toBe((seq % 255) + 1)
    ws.close()
  })

  it('ignores malformed DMX messages', async () => {
    const ws = new WebSocket(`${server.url.replace('http', 'ws')}dmx`)
    await new Promise((ok) => ws.on('open', ok))
    const before = packets.length
    ws.send('not json')
    ws.send(JSON.stringify({ u: -1, d: 'AAAA' }))
    ws.send(JSON.stringify({ u: 1, d: 12 }))
    await new Promise((ok) => setTimeout(ok, 100))
    expect(packets.length).toBe(before)
    ws.close()
  })

  it('answers /api/health', async () => {
    const r = await fetch(`${server.url}api/health`)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.artnet).toMatch(/^127\.0\.0\.1:/)
    expect(Array.isArray(j.nodes)).toBe(true)
  })

  it('mounts the pagepad relay at /api/pad', async () => {
    const r = await fetch(`${server.url}api/pad`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url.slice(0, -1) },
      body: JSON.stringify({ op: 'create' }),
    })
    expect(r.status).toBe(200)
  })

  it('serves static files and index.html at /', async () => {
    expect(await (await fetch(server.url)).text()).toContain('<title>throw')
    expect((await fetch(`${server.url}app.js`)).headers.get('content-type')).toContain('javascript')
    expect((await fetch(`${server.url}missing.js`)).status).toBe(404)
    expect((await fetch(`${server.url}..%2f..%2fetc%2fpasswd`)).status).toBe(404)
  })
})
