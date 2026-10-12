import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { networkInterfaces } from 'node:os'
import { toNodeHandler } from 'pagepad/node'
import { createRelay, memoryStore } from 'pagepad/server'
import { WebSocketServer } from 'ws'
import { createBridge } from './artnet-bridge.js'
import { serveStatic } from './static.js'

export type ServerOptions = { port: number; host: string; artnet: string; root: string; discover?: boolean }

const version = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version as string
  } catch {
    try {
      return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string
    } catch {
      return '0.0.0'
    }
  }
})()

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address)
}

/** The local throw server: the built app, the phone-remote relay and the Art-Net bridge. */
export async function startServer(opts: ServerOptions) {
  const bridge = await createBridge(opts.artnet, opts.discover ?? true)
  const pad = toNodeHandler(createRelay({ store: memoryStore() }))
  const files = serveStatic(opts.root)

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ version, artnet: bridge.target, nodes: bridge.nodes() }))
    } else if (path === '/api/pad') pad(req, res)
    else void files(req, res)
  })

  const wss = new WebSocketServer({ server, path: '/dmx', maxPayload: 64 * 1024 })
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(String(raw))
        if (!Number.isInteger(m.u) || m.u < 0 || m.u > 32767 || typeof m.d !== 'string') return
        const data = Buffer.from(m.d, 'base64')
        if (data.length < 1 || data.length > 512) return
        bridge.send(m.u, new Uint8Array(data))
      } catch {
        // not JSON: ignore
      }
    })
  })

  await new Promise<void>((ok) => server.listen(opts.port, opts.host, ok))
  const port = (server.address() as AddressInfo).port
  const shown = opts.host === '0.0.0.0' || opts.host === '::' ? 'localhost' : opts.host
  return {
    url: `http://${shown}:${port}/`,
    lanUrls: opts.host === '0.0.0.0' ? lanAddresses().map((ip) => `http://${ip}:${port}/`) : [],
    port,
    async close() {
      bridge.close()
      for (const c of wss.clients) c.terminate()
      wss.close()
      const closed = new Promise<void>((ok) => server.close(() => ok()))
      server.closeAllConnections() // long-polls from the remote would otherwise hold close() open
      await closed
    },
  }
}
