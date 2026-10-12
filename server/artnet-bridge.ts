import { createSocket } from 'node:dgram'
import { ARTNET_PORT, artDmx, artPoll, parseArtPollReply } from '../src/core/artnet.js'

export type ArtNode = { ip: string; shortName: string; longName: string; seen: number }

const POLL_EVERY = 3000
const NODE_TTL = 10_000

/** Sends ArtDMX to one target ("ip" or "ip:port") and, optionally, finds nodes with ArtPoll. */
export async function createBridge(target: string, discover: boolean) {
  const [host, portText] = target.split(':')
  const port = Number(portText) || ARTNET_PORT
  const sock = createSocket({ type: 'udp4', reuseAddr: true })
  const seq = new Map<number, number>()
  const nodes = new Map<string, ArtNode>()
  sock.on('error', () => undefined) // a network that goes away mid-show must not crash the server
  sock.on('message', (msg) => {
    const reply = parseArtPollReply(new Uint8Array(msg))
    if (reply) nodes.set(reply.ip, { ...reply, seen: Date.now() })
  })
  // Replies to ArtPoll go to port 6454; if another program holds it, discovery is off but sending works.
  await new Promise<void>((ok) => {
    sock.once('error', () => sock.bind(0, ok))
    sock.bind(discover ? ARTNET_PORT : 0, () => ok())
  })
  sock.setBroadcast(true)
  let timer: NodeJS.Timeout | undefined
  if (discover) {
    const poll = () => {
      sock.send(artPoll(), ARTNET_PORT, host.endsWith('.255') ? host : '255.255.255.255')
      for (const [ip, n] of nodes) if (Date.now() - n.seen > NODE_TTL) nodes.delete(ip)
    }
    poll()
    timer = setInterval(poll, POLL_EVERY)
  }
  return {
    target: `${host}:${port}`,
    send(universe: number, data: Uint8Array) {
      const s = ((seq.get(universe) ?? 0) % 255) + 1 // 1..255; 0 would switch sequencing off
      seq.set(universe, s)
      sock.send(artDmx(universe, s, data), port, host)
    },
    nodes: () => [...nodes.values()].map(({ seen: _, ...n }) => n),
    close() {
      clearInterval(timer)
      sock.close()
    },
  }
}
